const { expect, assert } = require("chai");
const { BigNumber } = require("ethers");
const { formatEther } = require("ethers/lib/utils");
const { ethers } = require("hardhat");

let owner;
let addr1;
let addr2;
let addr3;
let feeReceiver;
let pad;
let pad_market;
let busd;
const FEES_PERCENTAGE = 5;
const BNB_FEES = 1200000000000000
const min_fees = 30;
const max_fees = 70;

Date.prototype.addDays = function(days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

describe("PAD NFT Contract Testing", function () {

  this.beforeAll(async function(){
    try{
      [owner,addr1,addr2,addr3,feeReceiver] = await ethers.getSigners();

      const PAD = await ethers.getContractFactory("PAD");
      pad = await PAD.deploy();
      await pad.deployed();

      const BUSD = await ethers.getContractFactory("BEP20Token");
      busd = await BUSD.deploy();
      await busd.deployed();

      // Without saving gas
      const MarketPlace = await ethers.getContractFactory("PADMarket");
      pad_market = await upgrades.deployProxy(MarketPlace,[busd.address, pad.address, feeReceiver.address, feeReceiver.address, FEES_PERCENTAGE, BNB_FEES, min_fees, max_fees], { kind: 'uups' });
      await pad_market.deployed();

    }
    catch(ex){
      console.error(ex);
    }
  })

  it("Should mint 3 NFTs to owner (checked by balance)", async function () {
    
    // Input data
    const expected_result = 3

    // Mint 3 NFTs
    for(let i = 0; i < expected_result; i++){
      try{
        const tx = await pad.mint();
        await tx.wait()
      }
      catch(ex){
        console.error(ex);
      }
    }

    // SUT Call
    const real_result = await pad.balanceOf(owner.address);

    // Result
    expect(real_result).to.equal(expected_result);
  });

  it("Should mint 3 NFTs by address (checked by balance)", async function () {
    
    // Input data
    const expected_result = 3

    // Mint 3 NFTs
    for(let i = 0; i < expected_result; i++){
      try{
        const tx_addr1 = await pad.mintUser(addr1.address);
        await tx_addr1.wait()
        const tx_addr2 = await pad.mintUser(addr2.address);
        await tx_addr2.wait()
        const tx_addr3 = await pad.mintUser(addr3.address);
        await tx_addr3.wait()
      }
      catch(ex){
        console.error(ex);
      }
    }

    // SUT Call
    const real_result_1 = await pad.balanceOf(addr1.address);
    const real_result_2 = await pad.balanceOf(addr2.address);
    const real_result_3 = await pad.balanceOf(addr3.address);
    const ex3 = 2;

    // Result
    expect(real_result_1, 'ADDR1').to.equal(expected_result) &&
    expect(real_result_2, 'ADDR2').to.equal(expected_result) &&
    expect(real_result_3, 'ADDR3').to.equal(expected_result);

  });

  it("NFT's should be identical", async function () {
    
    // Input data
    const expected_result = [ 0, 1, 2 ];

    let real_result = [];

    const balance = await pad.balanceOf(owner.address);

    // SUT Call
    for(let i = 0; i < balance; i++){
      const token = await pad.tokenOfOwnerByIndex(owner.address, i);
      real_result.push(parseInt(token));
    }

    // Result
    expect(real_result).to.have.all.members(expected_result);
  });

  it("Should revert when addr1 try to use safeMint function", async function () {
    await expect(pad.connect(addr1).safeMint(addr1.address, "x")).to.be.reverted;
  });

  const TOKEN_1 = 4;
  const TOKEN_2 = 7;

  it("Should transfer approved tokens " + [TOKEN_1, TOKEN_2] + " to owner by owner of the tokens (checked by balance and tokens)", async function(){

    //Input data
    const balance_expected_result = 5;
    const expected_result = [ 0, 1, 2, TOKEN_1, TOKEN_2 ];

    let real_result = [];

    // Approval
    await expect(pad.connect(addr2).approve(owner.address, TOKEN_1),'First approval').to.emit(pad, 'Approval');
    await expect(pad.connect(addr2).approve(owner.address, TOKEN_2),'Second approval').to.emit(pad, 'Approval');

    expect(await pad.getApproved(TOKEN_1), 'Get approved token ' + TOKEN_1).to.equal(owner.address);
    expect(await pad.getApproved(TOKEN_2), 'Get approved token ' + TOKEN_2).to.equal(owner.address);

    // Transfer to Owner
    await pad.connect(addr2)["safeTransferFrom(address,address,uint256)"](addr2.address, owner.address, TOKEN_1);
    await pad.connect(addr2)["safeTransferFrom(address,address,uint256)"](addr2.address, owner.address, TOKEN_2);

    // Balance check
    const real_balance = await pad.balanceOf(owner.address);
    expect(balance_expected_result, 'Balance').to.equal(real_balance);

    // Tokens check
    for(let i = 0; i < real_balance; i++){
      const token = await pad.tokenOfOwnerByIndex(owner.address, i);
      real_result.push(parseInt(token));
    }

    expect(real_result, 'Tokens').to.have.all.members(expected_result);

  });

});

describe("BUSD Testing", function(){
  const BUSD_TRANSFER_Q = BigNumber.from("333000000000000000000");
  
  it("Balance of owner", async function(){
    const initial = BigNumber.from("31000000000000000000000000");
    expect(await busd.balanceOf(owner.address)).to.equal(initial);
  })

  it("Approve spent quantity", async function(){
    await expect(busd.approve(addr1.address, BUSD_TRANSFER_Q)).to.emit(busd, 'Approval');
    await expect(busd.approve(addr2.address, BUSD_TRANSFER_Q)).to.emit(busd, 'Approval');
    await expect(busd.approve(addr3.address, BUSD_TRANSFER_Q)).to.emit(busd, 'Approval');
  })

  it("Owner sends BUSD to other addresses", async function(){
    await busd.transfer(addr1.address, BUSD_TRANSFER_Q);
    expect(await busd.allowance(owner.address, addr1.address),'Addr1').to.equal(BUSD_TRANSFER_Q);

    await busd.transfer(addr2.address, BUSD_TRANSFER_Q);
    expect(await busd.balanceOf(addr2.address),'Addr2').to.equal(BUSD_TRANSFER_Q);
    
    await busd.transfer(addr3.address, BUSD_TRANSFER_Q);
    expect(await busd.balanceOf(addr3.address),'Addr3').to.equal(BUSD_TRANSFER_Q);
  })

});

describe("PAD Marketplace Testing", function () {

  // it("Should return if stored ERC721 PAD address in Marketplace is equal to real contract deployed address", async function () {
    
  //   // Input data
  //   const expected_result = pad.address;

  //   // SUT Call
  //   const real_result = await pad_market.getPADAddress();

  //   // Result
  //   expect(real_result).to.equal(expected_result);
  // });

  // it("Should return if stored feeReceiver in Marketplace is equal to real address", async function () {
    
  //   // Input data
  //   const expected_result = feeReceiver.address;
    
  //   // SUT Call
  //   const real_result = await pad_market.getFeeReceiver();
    
  //   // Result
  //   expect(real_result).to.equal(expected_result);
  // });
  
  // it("Check if fees percentage is 5", async function(){
  //   const expected = FEES_PERCENTAGE;
  //   expect(await pad_market.getFees(),'Fees').to.equal(expected);
  // });

  /*
    At this point:
    
    Owner : [ 0, 1, 2, 4, 7 ]
    Addr1 : [ 3, 6, 9 ]
    Addr2 : [ 10 ]
    Addr3 : [ 5, 8, 11 ] 

  */

  it("Addr3 try to change fees, should revert", async function(){
    const fees = 1;
    await expect(pad_market.connect(addr3).setPurchaseFees(fees),'Addr3 try to change fees').to.be.reverted;
  });

  it("Owner create offer without approval before, should revert", async function () {
    const today = new Date();
    const days = 2;
    const limit = today.addDays(days).getTime();

    const tokenId = 0;
    const price = ethers.utils.parseEther("1.0");
    const buyer = ethers.constants.AddressZero;

    await expect(pad_market.createOffer(tokenId, price, limit, buyer), 'Offer creation').to.be.revertedWith("You need to approve it");
  });

  // 1
  it("Owner should create the offer with {10 BUSD, 1day, 0x0}", async function () {

    const days = 1;
    let today = new Date();
    today = today.addDays(days).getTime();
    const limit = (today-(today%1000))/1000;

    const tokenId = 0;
    const price = ethers.utils.parseEther("10");
    const buyer = ethers.constants.AddressZero;
    const fees = { value : ethers.utils.parseEther("0.0012") }

    // Approval
    await expect(pad.approve(pad_market.address, tokenId),'Approval').to.emit(pad, 'Approval');

    // Create offer
    await expect(pad_market.createOffer(tokenId, price, limit, buyer, fees), 'Offer creation').to.emit(pad_market, 'MarketCardCreated');
  });

  it("Check all market offers", async function(){
    const cards = await pad_market.fetchAllMarketCardsComplete();
    // console.log(cards)
  })

  // 2
  it("Owner should create the offer with {20 BUSD, actual date (will expire in 1 sec), addr2}", async function () {

    let today = new Date();
    today = today.getTime();
    const limit = (today-(today%1000))/1000;

    const tokenId = 1;
    const price = ethers.utils.parseEther("20");
    const buyer = addr2.address;
    const fees = { value : ethers.utils.parseEther("0.0012") }

    // Approval
    await expect(pad.approve(pad_market.address, tokenId),'Approval').to.emit(pad, 'Approval');

    // Create offer
    await expect(pad_market.createOffer(tokenId, price, limit, buyer, fees), 'Offer creation').to.emit(pad_market, 'MarketCardCreated');
  });

  it("Addr3 try to buy token 1, should revert", async function () {
    const etherValue = 20;
    const priceValue = parseInt(ethers.utils.parseEther(etherValue.toString()));

    const feesValue = Math.floor(priceValue*FEES_PERCENTAGE) / 100;
    const totalPriceSent = priceValue + feesValue;
    
    const tokenId = 2;
    await expect(pad_market.connect(addr3).sellOffer(tokenId, BigInt(totalPriceSent)),'Buy card with different buyer').to.be.revertedWith("This card has a preferent buyer");
  });

  it("Addr2 try to buy token 1 with 15 BUSD, should revert", async function () {
    const etherValue = 15;
    const priceValue = parseInt(ethers.utils.parseEther(etherValue.toString()));

    const feesValue = Math.floor(priceValue*FEES_PERCENTAGE) / 100;
    const totalPriceSent = priceValue + feesValue;

    const tokenId = 2;
    await expect(pad_market.connect(addr2).sellOffer(tokenId, BigInt(totalPriceSent)),'Buy card with LESS different value').to.be.revertedWith("Overflow error generated by sending a price under the real price");
  });

  it("Addr2 try to buy token 1 with 22 BUSD, should revert", async function () {
    const etherValue = 22;
    const priceValue = parseInt(ethers.utils.parseEther(etherValue.toString()));

    const feesValue = Math.floor(priceValue*FEES_PERCENTAGE) / 100;
    // console.log(feesValue);
    const totalPriceSent = priceValue + feesValue;

    const tokenId = 2;
    await expect(pad_market.connect(addr2).sellOffer(tokenId, BigInt(totalPriceSent)),'Buy card with MORE different value').to.be.revertedWith("Please submit the asking price in order to complete the purchase");
  });

  it("Addr2 try to buy token 1, but the offer was expired, should revert", async function () {
    const etherValue = 20;
    const priceValue = parseInt(ethers.utils.parseEther(etherValue.toString()));

    const feesValue = Math.floor(priceValue*FEES_PERCENTAGE) / 100;
    const totalPriceSent = priceValue + feesValue;

    const tokenId = 2;
    await expect(pad_market.connect(addr2).sellOffer(tokenId, BigInt(totalPriceSent)),'Buy card with buyer but expired').to.be.revertedWith("Offer expired");
  });

  it("Addr1 buy token 0 with 10 BUSD", async function () {
    
    let before = await busd.balanceOf(owner.address);
    before = parseFloat(formatEther(before))
    
    let beforeFR = await busd.balanceOf(feeReceiver.address);
    beforeFR = parseFloat(formatEther(beforeFR))
    
    // Input data
    const etherValue= 10;
    const priceValue = parseInt(ethers.utils.parseEther(etherValue.toString()));
    
    const feesValue = Math.floor(priceValue * FEES_PERCENTAGE) / 100;
    const totalPriceSent = priceValue + feesValue;
    
    const tokenId = 1;
    
    // Approve
    await expect(busd.connect(addr1).approve(pad_market.address, BigInt(totalPriceSent))).to.emit(busd, 'Approval');
    
    // Buy operation
    await expect(pad_market.connect(addr1).sellOffer(tokenId, BigInt(totalPriceSent)), `Buy item ${tokenId}`).to.emit(pad_market, 'MarketCardSold');
    
    let after = await busd.balanceOf(owner.address);
    after = parseFloat(formatEther(after))
    
    let afterFR = await busd.balanceOf(feeReceiver.address);
    afterFR = parseFloat(formatEther(afterFR))
    
    // Check in balance
    expect(await pad.ownerOf(0),'NewBalance').to.equal(addr1.address);
    
    // Check if seller have recieved the price in his wallet
    expect((after-before),'Seller').to.equal(parseFloat(etherValue))

    // Check if feesReceiver have recieved the fees
    expect((afterFR - beforeFR),'Fees').to.equal(parseFloat(formatEther(BigInt(feesValue))))

  });

  // 3
  it("Owner should create the offer with {1 BUSD, 30 days, 0x0}", async function () {

    const days = 30;
    let today = new Date();
    today = today.addDays(days).getTime();
    const limit = (today-(today%1000))/1000;

    const tokenId = 4;
    const price = ethers.utils.parseEther("1");
    const buyer = ethers.constants.AddressZero;
    const fees = { value : ethers.utils.parseEther("0.0012") }

    // Approval
    await expect(pad.approve(pad_market.address, tokenId),'Approval').to.emit(pad, 'Approval');

    // Create offer
    await expect(pad_market.createOffer(tokenId, price, limit, buyer, fees), 'Offer creation').to.emit(pad_market, 'MarketCardCreated');
  });

  it("Should retire an offer", async function(){
    const item = 2;
    const fees = { value : ethers.utils.parseEther("0.0012") }
    await expect(pad_market.retireOffer(item, fees)).to.emit(pad_market,'MarketCardDeleted');
  });

  // it("Should revert if try to buy a deleted offer", async function(){
  //   const fees = { value : ethers.utils.parseEther("0.0012") }
  //   const itemId = 2;
  //   await expect(pad_market.connect(addr1).sellOffer(itemId, fees), `Buy item ${itemId}`).to.be.revertedWith("Retired offer");
  // });

  it("Should revert if try to buy a already bought card", async function(){
    const total = ethers.utils.parseEther("0.0001");
    const itemId = 1;
    await expect(pad_market.connect(addr1).sellOffer(itemId,BigInt(total)), `Buy item ${itemId}`).to.be.revertedWith("Card already bought");
  });

  // 4
  it("Addr3 should create the offer with {50 BUSD, 30 days, owner}", async function () {

    const days = 30;
    let today = new Date();
    today = today.addDays(days).getTime();
    const limit = (today-(today%1000))/1000;

    const tokenId = 11;
    const price = ethers.utils.parseEther("50");
    const buyer = owner.address;
    const fees = { value : ethers.utils.parseEther("0.0012") }

    // Approval
    await expect(pad.connect(addr3).approve(pad_market.address, tokenId),'Approval').to.emit(pad, 'Approval');

    // Create offer
    await expect(pad_market.connect(addr3).createOffer(tokenId, price, limit, buyer, fees), 'Offer creation').to.emit(pad_market, 'MarketCardCreated');
  });

  it("Check cards in the market", async function(){
    // Input data 
    const expected_result = [ 3, 4 ];
    let real_result = [];
    
    // SUT call
    const allCardsMarket = await pad_market.fetchAllMarketCards();
    // const filteredCards = allCardsMarket.filter(e => parseInt(e) !== 0);
    allCardsMarket.forEach(element => {
      if(parseInt(element) !== 0) { real_result.push(parseInt(element)); }
    })

    //Result
    expect(real_result,'Cards in marketplace').to.have.all.members(expected_result);
  });

  it("Owner should be able to change item 2", async function(){
    const days = 365;
    let today = new Date();
    today = today.addDays(days).getTime();
    const limit = (today-(today%1000))/1000;

    const itemId = 2;
    const price = ethers.utils.parseEther("100");
    const buyer = addr1.address;
    const fees = { value : ethers.utils.parseEther("0.0012") }


    await expect(pad_market.changeOffer(itemId, price, limit, buyer, fees),'Changing offer').to.emit(pad_market, 'MarketCardChanged');
  });

  it("Owner now, put again in the market item 2", async function(){
    const itemId = 2;
    const fees = { value : ethers.utils.parseEther("0.0012") }
    await pad_market.reOffer(itemId, fees);


    const item2 = await pad_market.getMarketCard(itemId);

    expect(item2.deleted).to.be.false;

  });

  it("Addr1 should be able to buy item 2", async function(){
    // Ether balance before
    let before = await busd.balanceOf(owner.address);
    before = parseFloat(formatEther(before))

    let beforeFR = await busd.balanceOf(feeReceiver.address);
    beforeFR = parseFloat(formatEther(beforeFR))

    // Input data
    const etherValue= 100;
    const priceValue = parseInt(ethers.utils.parseEther(etherValue.toString()));

    const feesValue = Math.floor(priceValue*FEES_PERCENTAGE) / 100;
    const totalPriceSent = priceValue + feesValue;
    
    const itemId = 2;

    // Approve
    await expect(busd.connect(addr1).approve(pad_market.address, BigInt(totalPriceSent))).to.emit(busd, 'Approval');
    
    // Buy operation
    await expect(pad_market.connect(addr1).sellOffer(itemId,BigInt(totalPriceSent)), `Buy item ${itemId}`).to.emit(pad_market, 'MarketCardSold');

    // Ether balance after
    let after = await busd.balanceOf(owner.address);
    after = parseFloat(formatEther(after))
    
    let afterFR = await busd.balanceOf(feeReceiver.address);
    afterFR = parseFloat(formatEther(afterFR))

    // Check in balance
    expect(await pad.ownerOf(1),'NewBalance').to.equal(addr1.address);
    
    // Check if seller have recieved the price in his wallet
    expect((after-before),'Seller').to.equal(parseFloat(etherValue))

    // Check if feesReceiver have recieved the fees
    expect((afterFR - beforeFR),'Fees').to.equal(parseFloat(formatEther(BigInt(feesValue))))

  });

  it("Addr3 try to change item 3, should revert", async function () {
    const new_address_buyer = addr3.address;
    const itemId = 3;
    await expect(pad_market.connect(addr3).changeOffer(itemId,1,1,new_address_buyer),'Try to change item 3').to.be.revertedWith("Caller is not the seller");
  });

  it("Addr3 try to delete item 3, should revert", async function () {
    const itemId = 3;
    await expect(pad_market.connect(addr3).retireOffer(itemId),'Try to delete item 3').to.be.revertedWith("Caller is not the seller");
  });

  it("Addr3 should be able to delete his item 4", async function(){
    const itemId = 4;
    const fees = { value : ethers.utils.parseEther("0.0012") }
    await expect(pad_market.connect(addr3).retireOffer(itemId, fees),'Delete item 4').to.emit(pad_market, 'MarketCardDeleted');
  });

  it("Check cards in the market", async function(){
    // Input data 
    const expected_result = [ 3 ];
    let real_result = [];
    
    // SUT call
    const allCardsMarket = await pad_market.fetchAllMarketCards();

    allCardsMarket.forEach(element => {
      if(parseInt(element) !== 0) { real_result.push(parseInt(element)); }
    })

    //Result
    expect(real_result,'Cards in marketplace').to.have.all.members(expected_result);
  });

  it("Addr2 try to pause contract, should revert", async function(){
    await expect(pad_market.connect(addr2).pause(),'Pausable, revert').to.be.reverted;
  });

  it("Should pause contract", async function(){
    await expect(pad_market.pause()).not.to.be.reverted;
  });

  it("Try to clean marketplace, should revert", async function(){
    const itemId = 3;
    await expect(pad_market.retireOffer(itemId),'Delete item 3. Clean marketplace, revert').to.be.revertedWith("Pausable: paused");
  });

  it("Addr3 attack contract and try to unpause, should revert", async function(){
    await expect(pad_market.connect(addr3).unpause(),'Unpausable, revert').to.be.reverted;
  });

  it("Should unpause contract", async function(){
    await expect(pad_market.unpause(),'Unpause').not.to.be.reverted;
  });

  it("Return item 3 to seller (owner)", async function(){
    let balanceBefore = await pad.balanceOf(owner.address);
    balanceBefore = parseInt(balanceBefore) //2
    const fees = { value : ethers.utils.parseEther("0.0012") }

    const itemId = 3;
    await expect(pad_market.returnCard(itemId, fees),'Return item 3 to owner').to.emit(pad_market, 'MarketCardReturned');

    expect(await pad.balanceOf(owner.address), 'Balance after card returned').to.equal(balanceBefore + 1);
  });

  it("Check cards in the market", async function(){
    // Input data 
    const expected_result = [];
    let real_result = [];
    
    // SUT call
    const allCardsMarket = await pad_market.fetchAllMarketCards();
    allCardsMarket.forEach(element => {
      if(parseInt(element) !== 0) { real_result.push(parseInt(element)); }
    })

    //Result
    expect(real_result,'Cards in marketplace').to.have.all.members(expected_result);
  });

  it('Should deploy new contract', async () => {    
    const MarketV2 = await ethers.getContractFactory("PADMarketv2");
    upgraded = await upgrades.upgradeProxy(pad_market.address, MarketV2);
  });

  it("Check cards in the new implementation of the market", async function(){
    // Input data 
    const expected_result = [ 1, 2, 4 ];
    let real_result = [];
    
    // SUT call
    const allCardsMarket = await upgraded.fetchAllMarketCards();
    allCardsMarket.forEach(element => {
      if(parseInt(element) !== 0) { real_result.push(parseInt(element)); }
    })

    //Result
    expect(real_result,'Cards in marketplace').to.have.all.members(expected_result);
  });

  let UPGRADER_ROLE = ethers.utils.id("UPGRADER_ROLE");
  let PAUSER_ROLE = ethers.utils.id("PAUSER_ROLE");

  it("Check if UPGRADER_ROLE hash is equal to contract", async function(){
    const expected = UPGRADER_ROLE;
    const real = await upgraded.UPGRADER_ROLE();
    expect(expected).to.equal(real);
  });

  it("Check if PAUSER_ROLE hash is equal to contract", async function(){
    const expected = PAUSER_ROLE;
    const real = await upgraded.PAUSER_ROLE();
    expect(expected).to.equal(real);
  });

  it("Owner should be able to set Addr1 as UPGRADER_ROLE", async function(){
    await expect(upgraded.grantRole(UPGRADER_ROLE, addr1.address),'UPGRADER_ROLE updated').not.to.be.reverted;
  });

  it("Addr3 shouldn't set Addr1 as PAUSER_ROLE", async function(){
    await expect(upgraded.connect(addr3).grantRole(PAUSER_ROLE, addr1.address),'PAUSER_ROLE updated').to.be.reverted;
  });

  it("Owner should be able to set Addr1 as PAUSER_ROLE", async function(){
    await expect(upgraded.grantRole(PAUSER_ROLE, addr1.address),'PAUSER_ROLE updated').not.to.be.reverted;
  });

  it("Addr3 shouldn't upgrade the contract", async function(){
    await expect(upgraded.connect(addr3).upgradeTo(pad_market.address),'Addr3 upgrade contract, revert exp').to.be.reverted;
  })

  it("Addr2 shouldn't pause the contract", async function(){
    await expect(upgraded.connect(addr2).pause(),'Addr2 pause contract, revert exp').to.be.reverted;
  })

  it("Owner should be able to set Addr3 as UPGRADER_ROLE", async function(){
    await expect(upgraded.grantRole(UPGRADER_ROLE, addr3.address),'UPGRADER_ROLE updated').not.to.be.reverted;
  });

  it("Addr1 shouldn't upgrade the contract", async function(){
    await expect(upgraded.connect(addr1).upgradeTo(pad_market.address),'Addr1 upgrade contract, revert exp').to.be.reverted;
  })

  it("Addr1 should pause the contract", async function(){
    await expect(upgraded.connect(addr1).pause(),'Addr1 pause contract').not.to.be.reverted;
  })

  it("Owner shouldn't pause the contract", async function(){
    await expect(upgraded.pause(),'Owner pause contract, revert exp').to.be.reverted;
  })

  // it("Owner shouldn't change fees", async function(){
  //   await expect(upgraded.setPurchaseFees(9),'Paused contract').to.be.reverted;
  // })

  it("Owner shouldn't upgrade the contract", async function(){
    await expect(upgraded.upgradeTo(pad_market.address),'Owner upgrade contract, revert exp').to.be.reverted;
  })

  it("Addr3 should upgrade the contract", async function(){
    await expect(upgraded.connect(addr3).upgradeTo(pad_market.address),'Addr3 upgrade contract').to.be.reverted;
  })

});