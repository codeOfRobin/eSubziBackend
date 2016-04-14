var mongoose = require('mongoose')
var bcrypt   = require('bcrypt-nodejs');
var Schema = mongoose.Schema;
var enumObject = {
  values: 'Customer Shopkeeper'.split(' '),
  message: 'enum validator failed for path `{PATH}` with value `{VALUE}`'
}
var userSchema =new Schema({
    email: String,
    password: String,
    userType: { type: String, enum: enumObject },
    phoneNumber:String,
    address:String,
    admin: Boolean
})

userSchema.methods.generateHash = function(password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
};

userSchema.methods.validPassword = function(password) {
    return bcrypt.compareSync(password, this.password);
};

var User = mongoose.model('User', userSchema);
module.exports = User;
