'use strict';
const uuid = require('uuid');
const AWS = require('aws-sdk');
const orderMetadataManager = require('./orderMetadataManager');


var sqs = new AWS.SQS({ region: process.env.REGION });
const QUEUE_URL = process.env.PENDING_ORDER_QUEUE;


module.exports.prepareOrder = (event, context, callback) => {
  console.log('Prepare Order was called');

  const order = JSON.parse(event.Records[0].body);

  orderMetadataManager
    .saveCompletedOrder(order)
    .then(data => {
      callback();
    })
    .catch(error => {
      callback(error);
    });
}

module.exports.makeOrder = (event, context, callback) => {
  const orderId = uuid.v1();
  console.log('making order was called');

  const body = JSON.parse(event.body);

  const order = {
    orderId,
    name: body.name,
    address: body.address,
    pizzas: body.pizzas,
    timestamp: Date.now()
  };

  const params = {
    MessageBody: JSON.stringify(order),
    QueueUrl: QUEUE_URL
  };

  sqs.sendMessage(params, function (err, data) {
    if (err) {
      sendResponse(500, err, callback);
    } else {
      console.log('data::', JSON.stringify(data));
      const message = {
        order,
        messageId: data.messageId
      };
      sendResponse(200, message, callback);
    }
  });

};

module.exports.sendOrder = (event, context, callback) => {
  console.log('sendOrder was called');

  const record = event.Records[0];
  if (record.eventName === 'INSERT') {
    console.log('deliverOrder');

    const orderId = record.dynamodb.Keys.orderId.S;

    orderMetadataManager
      .deliverOrder(orderId)
      .then(data => {
        console.log(data);
        callback();
      })
      .catch(error => {
        callback(error);
      });
  } else {
    console.log('is not a new record');
    callback();
  }
};

module.exports.stateOrder = (event, context, callback) => {
	console.log('stateOrder was called');

	const orderId = event.pathParameters && event.pathParameters.orderId;
	if (orderId !== null) {
		orderMetadataManager
			.getOrder(orderId)
			.then(order => {
				sendResponse(200, `The order state : ${orderId} is ${order.delivery_status}`, callback);
			})
			.catch(error => {
				sendResponse(500, 'it was an error processing the order', callback);
			});
	} else {
		sendResponse(400, 'orderId missing', callback);
	}
};

const sendResponse = (statusCode, message, callback) => {
  const response = {
    statusCode,
    body: JSON.stringify(message, null, 2)
  }

  callback(null, response);
}


