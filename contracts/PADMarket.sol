// SPDX-License-Identifier: MIT OR Apache-2.0
pragma solidity ^0.8.9;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/CountersUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title  PAD NFT Smart Contract
 * @notice This implements PAD NFT Smart Contract to use in Marketplace
 * @dev    Subject to changes
 */
interface IPADNFT{
  function safeTransferFrom(address from, address to, uint256 tokenId) external;
  function ownerOf(uint256 tokenId) external view returns (address owner);
  function getApproved(uint256 tokenId) external view returns (address operator);
}

/**
 * @title  A Marketplace for PAD Game
 * @author EscuelaCryptoES
 * @notice This smart contract implements a digital marketplace to use in PAD Game
 */
contract PADMarket is Initializable, OwnableUpgradeable, UUPSUpgradeable, IERC721ReceiverUpgradeable, ReentrancyGuardUpgradeable, PausableUpgradeable, AccessControlUpgradeable {
  using CountersUpgradeable for CountersUpgradeable.Counter;

  CountersUpgradeable.Counter private _itemIds;
  CountersUpgradeable.Counter private _itemsSold;
  address private PAD_ADDRESS;
  IERC20Upgradeable private BUSD;

  address private MIN_FEE_RECEIVER;
  address private MAX_FEE_RECEIVER;
  uint256 private FEES;
  uint256 private BNB_FEES;
  uint8   private min_fee;
  uint8   private max_fee;

  // Market cards mapping
  mapping(uint256 => MarketCard) private idToMarketCard;

  // Struct to store an offer into Marketplace
  struct MarketCard {
    uint256          itemId;
    uint256          tokenId;
    uint256          price;
    uint256          limit;
    address payable  seller;
    address payable  owner;
    address          buyer;
    bool             deleted;
  }

  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant UPGRADER_ROLE = keccak256("UPGRADER_ROLE");
  bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

  /**
    * @notice This modifier checks if the caller is the owner of the card
    * @param tokenId The id of the token to check
    */
  modifier isOwner(uint256 tokenId){

    require(
      IPADNFT(PAD_ADDRESS).ownerOf(tokenId) == msg.sender, 
      "You are not the owner of the card"
    );

    require(
      IPADNFT(PAD_ADDRESS).getApproved(tokenId) == address(this),
      "You need to approve it"
    );

    _;
  }

  /**
    * @notice This modifier checks if the caller is the seller of that item
    * @param itemId The id of the offer stored into mapping
    */
  modifier isSeller(uint256 itemId){
    require(
      itemId > 0,
      "Please, use a valid item"
    );

    address seller = idToMarketCard[itemId].seller;
    require(
      seller == msg.sender,
      "Caller is not the seller"
    );

    _;
  }

  // IERC721Receiver required
  event Received();

  // If an offer is correctly added into mapping
  event MarketCardCreated (
    uint256 indexed itemId,
    uint256 indexed tokenId,
    address         seller,
    address         buyer,
    uint256         price,
    uint            limit
  );

  // If an offer is correctly sold
  event MarketCardSold (
    uint256 indexed itemId,
    uint256 indexed tokenId,
    address         seller,
    address         owner,
    uint256         price,
    uint            limit
  );

  // If an offer is correctly changed by the seller 
  event MarketCardChanged (
    uint256 indexed itemId,
    uint256 indexed tokenId,
    address         seller,
    address         buyer,
    uint256         price,
    uint            limit
  );

  // If an offer is correctly retired from the marketplace
  event MarketCardDeleted (
    uint256 indexed itemId
  );

  // If an offer is correctly returned to the seller
  event MarketCardReturned (
    uint256 indexed itemId,
    uint256 indexed tokenId,
    address         seller
  );

  /// @custom:oz-upgrades-unsafe-allow constructor
  constructor() initializer {}

  /**
    * @notice Initializer of proxy
    */
  function initialize(address _BUSD, address _NFTContract, address _mfeeReceiver, address _MfeeReceiver, uint _fees, uint _bnbfees, uint8 mf, uint8 _Mf) public initializer {
    __Ownable_init();
    __Pausable_init();
    __AccessControl_init();
    __UUPSUpgradeable_init();

    _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
    _grantRole(PAUSER_ROLE, msg.sender);
    _grantRole(UPGRADER_ROLE, msg.sender);

    _itemIds.increment();
    BUSD = IERC20Upgradeable(_BUSD);
    PAD_ADDRESS = _NFTContract;
    MIN_FEE_RECEIVER = _mfeeReceiver;
    MAX_FEE_RECEIVER = _MfeeReceiver;
    FEES = _fees;
    BNB_FEES = _bnbfees;
    min_fee = mf;
    max_fee = _Mf;
  }

  /**
    * @notice Creates an offer in marketplace
    * @param tokenId The NFT token from PAD SC
    * @param price The price in wei
    * @param limit Limit day to send the card
    * @param _buyer Preferent buyer address
    */
  function createOffer(uint256 tokenId, uint256 price, uint limit, address _buyer) public payable isOwner(tokenId) nonReentrant whenNotPaused {
    require(price > 0, "Price must be at least 1 BUSD");
    require(limit > 0, "Limit timestamp must be greater than 0");
    require(msg.value == BNB_FEES, "Fees not sent");

    uint256 itemId = _itemIds.current();
    _itemIds.increment();
    
    address buyer = (_buyer != address(0)) ? _buyer : address(0);

    idToMarketCard[itemId] =  MarketCard(
      itemId,
      tokenId,
      price,
      limit,
      payable(msg.sender),
      payable(address(0)),
      buyer,
      false
    );


    IPADNFT(PAD_ADDRESS).safeTransferFrom(msg.sender, address(this), tokenId);

    emit MarketCardCreated(
      itemId,
      tokenId,
      msg.sender,
      buyer,
      price,
      limit
    );

    uint256 mf = msg.value * min_fee / 100; 
    uint256 Mf = msg.value * max_fee / 100;

    payable(MIN_FEE_RECEIVER).transfer(mf);
    payable(MAX_FEE_RECEIVER).transfer(Mf);
  }

  /**
    * @notice Transfers a card to a buyer
    * @param itemId Item id to sell
    */
  function sellOffer(uint256 itemId, uint256 _amount) public payable nonReentrant whenNotPaused {

    require(itemId > 0, "Please use a valid item");
    require(!idToMarketCard[itemId].deleted, "Retired offer");
    require(idToMarketCard[itemId].owner == address(0), "Card already bought");

    uint256 realPrice = idToMarketCard[itemId].price;
    
    require(_amount > realPrice , "Overflow error generated by sending a price under the real price");
    
    uint256 fees = realPrice * (FEES) / 100;
    uint256 priceSent = _amount - fees;
    
    MarketCard storage token = idToMarketCard[itemId];

    require(priceSent == realPrice, "Please submit the asking price in order to complete the purchase");
    require(IERC20Upgradeable(BUSD).balanceOf(msg.sender) >= _amount, "BUSD: Insufficient funds");
    
    if(idToMarketCard[itemId].buyer != address(0)){
      require(idToMarketCard[itemId].buyer == msg.sender, "This card has a preferent buyer");
    }

    require(idToMarketCard[itemId].limit >= block.timestamp, "Offer expired");

    SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(BUSD), msg.sender, token.seller, realPrice);

    IPADNFT(PAD_ADDRESS).safeTransferFrom(address(this), msg.sender, token.tokenId);

    token.owner = payable(msg.sender);

    uint256 mf = fees * min_fee / 100; 
    uint256 Mf = fees * max_fee / 100;

    SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(BUSD), msg.sender, MIN_FEE_RECEIVER, mf);
    SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(BUSD), msg.sender, MAX_FEE_RECEIVER, Mf);

    _itemsSold.increment();

    emit MarketCardSold (
      itemId,
      token.tokenId,
      token.seller,
      token.buyer,
      token.price,
      token.limit
    );

  }

  /**
    * @notice Changes parameters of the offer
    * @param itemId The item id to change
    * @param price The price in wei
    * @param limit Limit day to send the card
    * @param _buyer Preferent buyer address
    */
  function changeOffer(uint256 itemId, uint256 price, uint limit, address _buyer) public payable isSeller(itemId) nonReentrant whenNotPaused {
    require(price > 0, "Price must be at least 1 wei");
    require(limit > 0, "Limit timestamp must be greater than 0");
    require(msg.value == BNB_FEES, "Fees not sent");
    
    MarketCard storage token = idToMarketCard[itemId];

    token.price = (token.price == price) ? token.price : price;
    token.limit = (token.limit == limit) ? token.limit : limit;
    token.buyer = (_buyer == address(0)) ? token.buyer : _buyer;

    emit MarketCardChanged (
      itemId,
      token.tokenId,
      token.seller,
      token.buyer,
      token.price,
      token.limit
    );

    uint256 mf = msg.value * min_fee / 100; 
    uint256 Mf = msg.value * max_fee / 100;

    payable(MIN_FEE_RECEIVER).transfer(mf);
    payable(MAX_FEE_RECEIVER).transfer(Mf);
  }

  /**
    * @notice Deslist a card from the market
    * @param itemId The item id to deslist
    */
  function retireOffer(uint256 itemId) public payable isSeller(itemId) nonReentrant whenNotPaused {
    require(msg.value == BNB_FEES, "Fees not sent");
    idToMarketCard[itemId].deleted = true;
    emit MarketCardDeleted(
      itemId
    );

    uint256 mf = msg.value * min_fee / 100; 
    uint256 Mf = msg.value * max_fee / 100;

    payable(MIN_FEE_RECEIVER).transfer(mf);
    payable(MAX_FEE_RECEIVER).transfer(Mf);
  }

  /**
    * @notice Relist a card into the market
    * @param itemId The item id to relist
    */
  function reOffer(uint256 itemId) public payable isSeller(itemId) nonReentrant whenNotPaused {
    require(msg.value == BNB_FEES, "Fees not sent");
    idToMarketCard[itemId].deleted = false;

    uint256 mf = msg.value * min_fee / 100; 
    uint256 Mf = msg.value * max_fee / 100;

    payable(MIN_FEE_RECEIVER).transfer(mf);
    payable(MAX_FEE_RECEIVER).transfer(Mf);
  }

  /**
    * @notice Returns a card to a seller
    * @param itemId The item id to return
    */
  function returnCard(uint256 itemId) public payable isSeller(itemId) nonReentrant whenNotPaused {
    require(msg.value == BNB_FEES, "Fees not sent");
    uint256 tokenId = idToMarketCard[itemId].tokenId;
    address payable seller = idToMarketCard[itemId].seller;

    IPADNFT(PAD_ADDRESS).safeTransferFrom(address(this), seller, tokenId);
    idToMarketCard[itemId].tokenId = 0;
    idToMarketCard[itemId].itemId = 0;

    emit MarketCardReturned(
      itemId,
      tokenId,
      seller
    );

    uint256 mf = msg.value * min_fee / 100; 
    uint256 Mf = msg.value * max_fee / 100;

    payable(MIN_FEE_RECEIVER).transfer(mf);
    payable(MAX_FEE_RECEIVER).transfer(Mf);
  }

  /**
    * @notice Returns an offer
    * @param MarketCardId the itemId to search in marketplace
    * @return The structure of the offer
    */
  function getMarketCard(uint256 MarketCardId) public view returns (MarketCard memory) {
    return idToMarketCard[MarketCardId];
  }
  
  /**
    * @notice Returns an uint256 array with the itemId of all the cards in marketplace
            Requirements:
              - Not sold
              - Not retired
              - Not expired

    * @return itemIds array of all the cards in marketplace
    */
  function fetchAllMarketCards() external view returns (uint256[] memory) {

    uint256 itemCount = _itemIds.current() - 1;

    uint256 unsoldItemCount = itemCount - _itemsSold.current();
    uint256[] memory items = new uint256[](unsoldItemCount);

    uint256 c = 0;

    for (uint256 i = 1; i <= itemCount; i++) {
      if ( idToMarketCard[i].owner == address(0)      && 
          !idToMarketCard[i].deleted                  && 
          idToMarketCard[i].limit >= block.timestamp  &&
          idToMarketCard[i].itemId != 0
          ) {
        items[c] = idToMarketCard[i].itemId;
        c++;
      }
    }
  
    return items;
  }

  /**
    * @notice Returns all the cards in marketplace
              Requirements:
              - Not sold
              - Not retired
              - Not expired

    * @return All the cards in marketplace by structure
    */
  function fetchAllMarketCardsComplete() external view returns(MarketCard[] memory){

    uint256 itemCount = _itemIds.current() - 1;

    uint256 unsoldItemCount = itemCount - _itemsSold.current();
    MarketCard[] memory items = new MarketCard[](unsoldItemCount);

    uint256 c = 0;

    for (uint256 i = 1; i <= itemCount; i++) {
      if (idToMarketCard[i].owner == address(0) && !idToMarketCard[i].deleted && idToMarketCard[i].limit >= block.timestamp) {
        MarketCard storage currentItem = idToMarketCard[i];
        items[c] = currentItem;
        c++;
      }
    }
  
    return items;
  }

  /**
    * @notice Returns the cards balance in marketplace of the caller
    * @return Caller's balance in marketplace
    */
  function marketBalanceOf() external view returns (uint){
    uint256 totalItemCount = _itemIds.current() - 1;
    uint256 myItemCount = 0;

    for (uint256 i = 1; i <= totalItemCount; i++) {
      if (idToMarketCard[i].seller == msg.sender && idToMarketCard[i].owner == address(0) && !idToMarketCard[i].deleted) {
        myItemCount++;
      }
    }

    return myItemCount;
  }

  /**
    * @notice Returns the cards balance in marketplace of the user specified in params 
    * @param _user The address to check
    * @return User's balance in marketplace
    */
  function marketBalanceOf(address _user) external view returns (uint){
    uint256 totalItemCount = _itemIds.current() - 1;
    uint256 myItemCount = 0;

    for (uint256 i = 1; i <= totalItemCount; i++) {
      if (idToMarketCard[i].seller == _user && idToMarketCard[i].owner == address(0) && !idToMarketCard[i].deleted) {
        myItemCount++;
      }
    }

    return myItemCount;
  }

  /**
    * @notice Returns the cards of the user specified in params
    * @param _userAddress The address to check
    * @return User's cards in marketplace
    */
  function fetchUserMarketCards(address _userAddress) public view returns (MarketCard[] memory) {
    uint256 totalItemCount = _itemIds.current() - 1;
    uint256 myItemCount = 0;

    for (uint256 i = 1; i <= totalItemCount; i++) {
      if (idToMarketCard[i].seller == _userAddress && idToMarketCard[i].owner == address(0)) {
        myItemCount++;
      }
    }

    //Structs needs to be fixed-size array, push method don't works on struct dynamic-arrays
    MarketCard[] memory items = new MarketCard[](myItemCount);
    uint256 c = 0;

    for (uint256 i = 1; i <= totalItemCount; i++) {
      if (idToMarketCard[i].seller == _userAddress && idToMarketCard[i].owner == address(0)) {
        MarketCard storage currentItem = idToMarketCard[i];
        items[c] = currentItem;
        c++;
      }
    }
  
    return items;
  }

  /**
    * @notice Returns an uint256 array of the cards of the user specified in params
    * @param _userAddress The address to check
    * @return User's cards in marketplace in uint256 array
    */
  function fetchUserMarketCardsById(address _userAddress) public view returns (uint256[] memory) {
    uint256 totalItemCount = _itemIds.current() - 1;
    uint256 myItemCount = 0;

    for (uint256 i = 1; i <= totalItemCount; i++) {
      if (idToMarketCard[i].seller == _userAddress && idToMarketCard[i].owner == address(0)) {
        myItemCount++;
      }
    }

    uint256[] memory items = new uint256[](myItemCount);
    uint256 c = 0;

    for (uint256 i = 1; i <= totalItemCount; i++) {
      if (idToMarketCard[i].seller == _userAddress && idToMarketCard[i].owner == address(0)) {
        items[c] = idToMarketCard[i].itemId;
        c++;
      }
    }
  
    return items;
  }
  
  /**
    * @dev Triggers stopped state.
    *
    * Requirements:
    *
    * - The contract must not be paused.
    */
  function pause() public onlyRole(PAUSER_ROLE) whenNotPaused {	
      _pause();	
  }	
  
  /**
    * @dev Returns to normal state.
    *
    * Requirements:
    *
    * - The contract must be paused.
    */
  function unpause() public onlyRole(PAUSER_ROLE) whenPaused {	
      _unpause();	
  }

  /**
    * @notice Sets the new purchase fee percentage
    * @param _fee Percentage
    */
  function setPurchaseFees(uint256 _fee) external onlyRole(ADMIN_ROLE) whenNotPaused {
    FEES = _fee;
  }

  /**
    * @notice Check the purchase fee percentage stored
    * @return The percentage
    */
  function getPurchaseFees() external view returns(uint256){
    return FEES;
  }

  /**
    * @notice Sets the new min fee percentage
    * @param _fee Percentage
    */
  function setMinFees(uint8 _fee) external onlyRole(ADMIN_ROLE) whenNotPaused {
    min_fee = _fee;
  }

  /**
    * @notice Check the min fee percentage stored
    * @return The percentage
    */
  function getMinFees() external view returns(uint8){
    return min_fee;
  }

  /**
    * @notice Sets the new max fee percentage
    * @param _fee Percentage
    */
  function setMaxFees(uint8 _fee) external onlyRole(ADMIN_ROLE) whenNotPaused {
    max_fee = _fee;
  }

  /**
    * @notice Check the max fee percentage stored
    * @return The percentage
    */
  function getMaxFees() external view returns(uint8){
    return max_fee;
  }

  /**
    * @notice Sets the new min fee receiver address
    * @param _feeReceiver The address to set
    */
  function setMinFeeReceiver(address _feeReceiver) external onlyRole(ADMIN_ROLE) whenNotPaused {
    MIN_FEE_RECEIVER = _feeReceiver;
  }

  /**
    * @notice Check the min fee receiver address stored
    * @return The min fee receiver address
    */
  function getMinFeeReceiver() external view returns(address){
    return MIN_FEE_RECEIVER;
  }

  /**
    * @notice Sets the new max fee receiver address
    * @param _feeReceiver The address to set
    */
  function setMaxFeeReceiver(address _feeReceiver) external onlyRole(ADMIN_ROLE) whenNotPaused {
    MAX_FEE_RECEIVER = _feeReceiver;
  }

  /**
    * @notice Check the max fee receiver address stored
    * @return The max fee receiver address
    */
  function getMaxFeeReceiver() external view returns(address){
    return MAX_FEE_RECEIVER;
  }

  /**
    * @notice Sets the new percentage of BNB
    * @param _bnbfee BNB Percentage
    */
  function setBNBFees(uint256 _bnbfee) external onlyRole(ADMIN_ROLE) whenNotPaused {
    BNB_FEES = _bnbfee;
  }

  /**
    * @notice Check the fee BNB percentage stored
    * @return The percentage
    */
  function getBNBFees() external view returns(uint256){
    return BNB_FEES;
  }
  
  /**
    * @notice Sets the new PAD_Address
    * @param _address The new PAD_Address
    */
  function setPADAddress(address _address) external onlyRole(ADMIN_ROLE) whenNotPaused {
    PAD_ADDRESS = _address;
  }

  /**
    * @notice Check the PAD_Address stored
    * @return The PAD_Address
    */
  function getPADAddress() external view returns(address){
    return PAD_ADDRESS;
  }

  /**
    * @dev Whenever an {IERC721} `tokenId` token is transferred to this contract via {IERC721-safeTransferFrom}
    * by `operator` from `from`, this function is called.
    *
    * It must return its Solidity selector to confirm the token transfer.
    * If any other value is returned or the interface is not implemented by the recipient, the transfer will be reverted.
    *
    * The selector can be obtained in Solidity with `IERC721.onERC721Received.selector`.
    */
  function onERC721Received(address _operator, address _from, uint256 _tokenId, bytes calldata _data) external override returns(bytes4) {
    _operator;
    _from;
    _tokenId;
    _data;
    emit Received();
    return 0x150b7a02;
  }

  /**
    * @dev Function that should revert when `msg.sender` is not authorized to upgrade the contract. Called by
    * {upgradeTo} and {upgradeToAndCall}.
    *
    * Normally, this function will use an xref:access.adoc[access control] modifier such as {Ownable-onlyOwner}.
    *
    * ```solidity
    * function _authorizeUpgrade(address) internal override onlyOwner {}
    * ```
    */
  function _authorizeUpgrade(address newImplementation)
      internal
      onlyRole(UPGRADER_ROLE)
      override
  {}

}