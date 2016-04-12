var mongoose = require('mongoose')

var Schema = mongoose.Schema;
var enumObject = {
  values: 'Android iPhone'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
}

var deviceSchema = new Schema
({
    token: String,
    deviceType: { type: String, enum: enumObject },
    email: String,
    subscribedIDs: [String]
});

var Device = mongoose.model('Device', deviceSchema);
module.exports = Device;
