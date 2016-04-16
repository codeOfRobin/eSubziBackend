var request = require('request')
var Device = require('../models/device');
function sendPushes(pushMessage,regArr)
{
	console.log(regArr.length+" len");
	console.log(regArr[0]);
		request({
		  uri: "https://gcm-http.googleapis.com/gcm/send",
		  method: "POST",
		  headers: {
		    'Authorization': 'key=AIzaSyAWNh0qvyYpOP7hJC3Nkh6PJ9zj0ydPQfs',
			'Content-type':'application/json'
			},
			json:
			{
				data:
				{
					message: pushMessage
				},
				registration_ids:regArr
			}
		}, function(error, response, body) {
		  console.log(response);
		});
}
//"ekxywP1V6Z8:APA91bG9TZ8NsS7xjRqx2cXg0yy1MzdNvu0ypsiP0_25j98hyTRQi2IiayMVag_WyUEhcl35MqBh1a7GqPQz5bTjHLYLOZ-RJ6KLWhH_GjAG90oNQSDYF1vJe1SsTCGf-B2doxPk5FcA"
//elhci1kOtGo:APA91bGIeLt1Fdqri-GGTb2aGz_I-Neq4ZWDRj4__O_BlR8D34Yuyz2HU8WKPxO2BzqZya19uPnWWmd1JRjHtDf4E80F5NnxWsb5q14yLp1UieimkTv3orI8FK0C3KPF-iARoROIZXmN
module.exports.sendPushes = sendPushes
