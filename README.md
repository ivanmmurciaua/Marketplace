# PAD Marketplace Smart Contracts

## Análisis de requisitos

En el marketplace, se mostrarán todas las cartas en venta.
Cada usuario tendrá sus propias cartas en visualiización: en venta y vendidas.
Un usuario podrá mintear sus cartas si son lazy => comprobar si esa carta existe en el balance del usuario en blockchain, si no, es lazy.
Un usuario podrá poner a la venta su carta *SOLO SI ESTÁ MINTEADA* => para ello habrá que aprobar el uso del SC del Mktplace en el proxy de PAD.

Un usuario podrá poner:

 - Precio.
 
 - Límite de días.
 
 - (OPCIONAL) Address de un comprador al que reservar la carta. => Si se intenta comprar desde una address que no es la guardada, no se vende.
 
Habrá que darle la opción al usuario de modificar CADA dato de su oferta y eliminar la misma. 
