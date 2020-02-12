'use strict';

const uuidv1 = require('uuid/v1');
const AWS = require('aws-sdk');
const orderMetaDataManager = require('./orderMetadataManager');

var sqs = new AWS.SQS({ region: process.env.REGION });
const QUEUE_URL = process.env.PENDING_ORDERS_QUEUE;

module.exports.hacerPedido = (event, context, callback) => {

  console.log('recibiendo un pedido...');
  const body = JSON.parse(event.body);

  const order = {
    orderId: uuidv1(),
    name: body.name,
    pizzas: body.pizzas,
    address: body.address,
    timestamp: Date.now()
  }
  
  const params = {
    MessageBody: JSON.stringify(order),
    QueueUrl: QUEUE_URL
  }

  // enviamos el mensaje a la cola
  sqs.sendMessage(params, function(err, data) {
    if (err) {
      // si ocurre un error
      sendResponse(500, err, callback);
    } else {
      // si es exitoso
      const message = {
        order: order,
        messageId: data.MessageId
      }
      sendResponse(200, message, callback);
    }
  });

};

module.exports.prepararPedido = (event, context, callback) => {
  console.log('prepararPedido fue llamado');
  
  const order = JSON.parse(event.Records[0].body);

  orderMetaDataManager
    .saveCompleteOrder(order)
    .then(data => {
      callback();
    }) 
    .catch(error => {
      callback(error);
    });
};

module.exports.enviarPedido = (event, context, callback) => {
  console.log('enviar pedido fue llamado');
  console.log(event);

  const record = event.Records[0];
  if (record.eventName === 'INSERT') {
    console.log('deliverOrder');

    const orderId = record.dynamodb.Keys.orderId.S;

    orderMetaDataManager
      .deliverOrder(orderId)
      .then(data => {
        console.log(data);
        callback();
      })
      .catch(error => {
        callback();
      })
  } else {
    console.log('No es un nuevo record');
    callback();
  }
}

module.exports.estadoPedido = (event, context, callback) => {
  console.log('Estado pedido fue llamado');
  console.log('event =', event);

  const orderId = event.pathParameters && event.pathParameters.orderId;

  orderMetaDataManager
    .getOrder(orderId)
    .then(data => {
      console.log('data = ', data);
      const mensaje = {
        orderId: orderId,
        estado: data.delivery_status
      }

      sendResponse(200, mensaje, callback);
    })
    .catch(error => {
      callback();
    })
}

function sendResponse(statusCode, message, callback) {
  const response = {
		statusCode: statusCode,
		body: JSON.stringify(message)
	};
	callback(null, response);
}
