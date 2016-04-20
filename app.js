var express    = require('express');
var bodyParser = require('body-parser');
var app        = express();
var morgan     = require('morgan');
var Product = require('./models/product').Product;
var mongoose   = require('mongoose');
var router = express.Router();
var pushiPhone = require('./apns/pushiPhone')
var pushAndroid = require('./androidPush/androidPNS')
var async = require('async')
var passport = require('passport')
var config = require('./models/config');
var User   = require('./models/user');
var Order   = require('./models/order');
var Discount = require('./models/discount');
var Device = require('./models/device');
var LocalStrategy   = require('passport-local').Strategy;
var jwt = require('jsonwebtoken');
var multer = require('multer');
var img = require('easyimage');
var fs = require('fs')
var path = require('path')
var secret = 'superSecret'

var upload = multer({ dest: './uploads' })
app.use(express.static(__dirname + '/uploads'));


function getExtension(fn) {
    return fn.split('.').pop();
}
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(morgan('tiny'))
app.use(passport.initialize());

mongoose.connect('mongodb://localhost/eSubzi');

app.set(secret, config.secret);

passport.use('localLogin',new LocalStrategy(
    {
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : false
    },
    function(email, password, done)
    {
        User.findOne({ 'email': email }, function(err, user)
        {
            if (err) { return done(err); }
            if (!user)
            {
                return done(null, false, { message: 'Incorrect username.' });
            }
            if (!user.validPassword(password))
            {
                return done(null, false, { message: 'Incorrect password.' });
            }
            return done(null, user);
        });
    }
));

passport.use('localSignup',new LocalStrategy(
    {
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true
    },
    function(req,email,password,done)
    {
        User.findOne({'email':email},function(err,user)
        {
            if(err)
            return done(err)
            if(user)
            {
                return done(null, false, { message: 'email already exists'});
            }
            else
            {
                var newUser = new User()
                newUser.email = email
                newUser.password = newUser.generateHash(password)
                newUser.userType = req.body.userType
                newUser.address=req.body.address
                newUser.phoneNumber=req.body.phoneNumber
                newUser.save(function(err)
                {
                    if(err)
                    throw err
                    return done(null,newUser)
                })
            }
        })

    }
))

router.get('/', function(req, res)
{
    res.json({ message: 'hooray! welcome to our api!' });
});

router.post('/login', function(req, res, next)
{
    passport.authenticate('localLogin', function(err, user, info) {
        if (err) { return next(err) }
        if (!user) {
            console.log(info.message);
            return res.status(401).json({ error: info.message });
        }

        var token = jwt.sign(user, app.get(secret), {
            expiresIn: 24*60*60 // expires in 24 hours
        });
        res.json({ token : token, userId:user._id, email:user.email, type:user.userType});

    })(req, res, next);
});

router.post('/signup', function(req, res, next)
{
    passport.authenticate('localSignup', function(err, user, info) {
        if (err) { return next(err) }
        if(!user){
            console.log(info.message);
            return res.json({ error: info.message });
        }
        var token = jwt.sign(user, app.get(secret), {
            expiresIn: 24*60*60 // expires in 24 hours
        });
        res.json({ token : token, email:user.email, userId:user._id,type:user.userType});

    })(req, res, next);
});


// router.use(function(req, res, next)
// {
//     var token = req.body.token || req.query.token || req.headers['x-access-token'];
//     if (token) {
//         // verifies secret and checks exp
//         jwt.verify(token, app.get(secret), function(err, decoded) {
//             if (err) {
//                 return res.json({ success: false, message: 'Failed to authenticate token.' });
//             } else {
//                 // if everything is good, save to request for use in other routes
//                 req.decoded = decoded;
//                 next();
//             }
//         });
//
//     } else {
//         // if there is no token
//         // return an error
//         return res.status(403).send({
//             success: false,
//             message: 'No token provided.'
//         });
//
//     }
// });

//token required before fetching products or other apis below
router.route('/register')
.post(function(req, res){
    var device = new Device();
    device.deviceType=req.body.type;
    device.email=req.body.email;
    device.token=req.body.regId;
    device.subscribedIDs=[];
    Device.findOne({token:req.body.regId},function(err, deviceN)
    {
        if (err)
        {
            res.send(err)
        }
        if(!deviceN)
        {
            device.save(function(err)
            {
                if (err)
                {
                    res.send(err);
                }
                console.log(device);
                res.json({ message: 'New Device registered', Device: device});
            });
        }else{
            res.json({message:'Already Registered' , Device: deviceN});
        }

    });
});
router.route('/unregister')
.post(function(req, res){
    Device.findOne({_id:req.body.id},function(err, device)
    {
        if (err)
        {
            res.send(err)
        }
        if(!device){
            res.json({message:'User not deleted'});
        }else{
            device.remove(function(err) {
                if (err) throw err;
                console.log('User successfully deleted');
                res.json({message:'User successfully deleted'});
            });
        }
    });
});


router.route('/products/find')
.post(function(req, res)
{
    Product.find({userId:req.body.userId},null, {sort: '-created_at'},function(err, products)
    {
        if (err)
        {
            res.send(err)
        }
        res.json({products:products});
    });
});

router.route('/products/get')
.get(function(req, res)
{
    Product.find({},null, {sort: '-created_at'},function(err, products)
    {
        if (err)
        {
            res.send(err)
        }
        res.json(products);
    });
})
router.route('/product/delete')
.post(function(req, res)
{
    Product.findOne({_id:req.body.id},function(err, product)
    {
        if (err)
        {
            res.send(err)
        }
        if(!product){
            res.json({message:'product not found'});
        }else{
            product.remove(function(err){
                if (err){
                    res.json({message:'error'});
                }
                res.json({message:'product removed'});
            });
        }

    });
})

router.route('/products/create')
.post(function(req,res)
{
    var product = new Product();
    product.price =  req.body.price || '0',
    product.quantity = req.body.quantity || '0',
    product.description = req.body.description,
    product.discount = req.body.discount || '0',
    product.userId=req.body.userId || '0',
    product.userEmail=req.body.userEmail || '0'
    product.photoUrl=""
    product.save(function(err)
    {
        if (err)
        {
            res.send(err);
        }
        res.json({ message: 'product created!', newProduct: product});
    });
});

router.route('/updatePrice')
.post(function(req, res)
{
    if (req.body.price == 0)
    {
        res.send({message : "price can't be 0"})
    }
    else
    {
        Product.findOne({ _id: req.body.id }, function(err, product)
        {
            if(!product)
            {
                console.log("not found");
                res.json({ message: 'Not found'});
            }
            else
            {
                product.price = req.body.price;
                product.save(function(err)
                {
                    if (err)
                    {
                        res.send(err);
                    }
                    res.json({ message: 'Product price updated!' ,newProduct:product});
                });
            }
        });
    }
});
router.route('/updateQuantity')
.post(function(req, res)
{
    if (req.body.quantity == 0)
    {
        res.send({message : "Quantity can't be 0"})
    }
    else
    {
        Product.findOne({ _id: req.body.id }, function(err, product)
        {
            if(!product)
            {
                console.log("not found");
                res.json({ message: 'Not found'});
            }
            else
            {
                product.quantity = req.body.quantity;
                product.save(function(err)
                {
                    if (err)
                    {
                        res.send(err);
                    }
                    res.json({ message: 'Product quantity updated!' ,newProduct:product});
                });
            }
        });
    }
});
router.route('/updateName')
.post(function(req, res)
{
    if (req.body.description == '')
    {
        res.send({message : "Description can't be empty"})
    }
    else
    {
        Product.findOne({ _id: req.body.id }, function(err, product)
        {
            if(!product)
            {
                console.log("not found");
                res.json({ message: 'Not found'});
            }
            else
            {
                product.description = req.body.description;
                product.save(function(err)
                {
                    if (err)
                    {
                        res.send(err);
                    }
                    res.json({ message: 'Product description updated!' ,newProduct:product});
                });
            }
        });
    }
});

router.route('/discounts/get')
.get(function(req,res)
{
    Discount.find(function(err, discounts)
    {
        if (err)
        {
            res.send(err)
        }
        res.json({Discounts:discounts});
    });
})
router.route('/getSubscriptions')
.post(function(req,res)
{

    Device.findOne({_id:req.body.deviceId}, function(err, device)
    {
        if(!device){
            console.log('not found');
            res.json({ message: 'not found'});
        }else{
            User.find({ userType: 'Shopkeeper' }, function(err, users)
            {
                if(!users){
                    console.log('not found users');
                    res.json({ message: 'not shopkeeper found'});
                }else{
                    console.log(device.subscribedIDs+':len'+device.id)
                    //console.log(device.length+'rajat'+device[0]._id);
                    res.json({ message: 'found', SubscribedIds: device.subscribedIDs, Users:users});

                }
            });
            //res.json({ message: 'found', SubscribedIds: device.subscribedIDs});

        }
    });
});
router.route('/setSubscriptions')
.post(function(req,res)
{
    console.log(req.body.subscribedIDs);
    Device.findOne({ _id: req.body.id }, function(err, device)
    {
        if(!device){
            console.log('not found');
            res.json({ message: 'not set'});
        }else{
            console.log(device._id);
            device.subscribedIDs = req.body.subscribedIDs;
            device.save(function(err)
            {
                if (err)
                {
                    res.send(err);
                }
                res.json({ message: 'preferences set', updatedDevice: device});
            });
        }
    });

});

router.route('/discounts/create')
.post(function(req,res)
{
    var discount = new Discount()
    discount.shopKeeperId = req.body.shopKeeperId
    discount.discountDescription = req.body.discountDescription
    var regArr =[];
    Device.find({},function(err,devices)
    {
        console.log(devices.length);
        for(var y=0;y<devices.length;y++)
        {
            if(devices[y].deviceType=="Android" && devices[y].subscribedIDs.indexOf(discount.shopKeeperId)!=-1)
            {
                regArr.push(devices[y].token);
            }
        }
        discount.save(function(err)
        {
            if (err)
            {
                res.send(err);
            }

            async.series([
                async.asyncify(pushiPhone.sendPushes(discount.discountDescription)),
                async.asyncify(pushAndroid.sendPushes(discount.discountDescription,regArr))
            ]);
            res.json({ message: 'discount added!', newDiscount: discount});
        });
    });

})

router.route('/changeDiscount')
.post(function(req, res)
{
    console.log(req.body);
    Product.findOne({ _id: req.body.id }, function(err, product)
    {
        if(!product){
            console.log("not found");
            res.json({ message: 'Not found'});
        }else{
            product.discount=req.body.discount || '0';
            var regArr =[];

            Device.find({},function(error,devices){
                console.log(devices.length+'rajat');
                if(error){
                    res.send(error)
                }

                for(var y=0;y<devices.length;y++){
                    if(devices[y].deviceType=="Android" && devices[y].subscribedIDs.indexOf(product.userId)!=-1){
                        regArr.push(devices[y].token);
                    }
                }
                product.save(function(err)
                {
                    if (err)
                    {
                        res.send(err);
                    }
                        console.log("Discount on "+product.description+" at "+product.userEmail+" changed to " + product.discount);
                    async.series([
                        async.asyncify(pushiPhone.sendPushes("Discount on "+product.description+" at "+product.userEmail+" changed to " + product.discount)),
                        async.asyncify(pushAndroid.sendPushes("Discount on "+product.description+" at "+product.userEmail+" changed to " + product.discount,regArr))
                    ]);
                    res.json({ message: 'Discount value changed!', newProduct : product});
                });

            });

        }
    });
});

router.route('/placeOrder')
.post(function(req, res)
{
    console.log(req.body);
    var items = Object.keys(req.body.items);
    Product.find({ _id: { $in: items } }, function (err, result)
    {
        if (err)
        {
            console.log(err);
            res.send(err)
        }

        if (!result)
        {
            res.send("invalid orders")
        }
        else{
            var order = new Order()
            order.customerId = req.body.customerId,
            order.shopKeeperId = req.body.shopKeeperId,
            order.customerEmail=req.body.customerEmail,
            order.currentState = 'OrderReceived'
            order.items = result.map(function(orderProduct){
                return {product:orderProduct , orderQuantity:req.body.items[orderProduct._id]};
            })
            console.log(order.items)
            //
            var regArr =[];
            User.findOne({_id:order.shopKeeperId},function(err, user){
                if(err){
                    res.send(err)
                }
                Device.findOne({email:user.email},function(error,device){
                    //console.log(device.email+'rajat');
                    if(error){
                        res.send(error)
                    }
                    if(!device){
                        order.save(function(err)
                        {
                            if (err)
                            {
                                res.send(err);
                            }

                            res.json({ message: 'order Recieved' ,newOrder : order});
                        });
                    }else{
                        if(device.deviceType=="Android"){
                            regArr.push(device.token);
                        }
                    //}
                    order.save(function(err)
                    {
                        if (err)
                        {
                            res.send(err);
                        }
                        async.series([
                            //async.asyncify(pushiPhone.sendPushes("Discount changed to " + product.discount)),
                            async.asyncify(pushAndroid.sendPushes("Order placed by " + order.customerEmail,regArr))
                        ]);
                        res.json({ message: 'order Recieved' ,newOrder : order});
                    });
                    }
                    //for(var y=0;y<devices.length;y++){


                });
            });

            //

        }

    });
});


router.route('/changeOrderState')
.post(function(req, res){
    Order.findOne({'_id':req.body.orderId },function(err, order){
        if(!order){
            res.json({ message: 'Invalid order' });
        }else{
            order.currentState=req.body.order_state;
            order.save(function(err)
            {
                if (err)
                {
                    res.send(err);
                }
                res.json({ message: 'order state changed' ,modifiedOrder : order});
            });
        }
    });
});

router.route('/findOrders')
.post(function(req, res){
    var type =req.body.usertype;
    if(type==='Customer'){
        Order.find({'customerId':req.body.userId },null, {sort: '-created_at'},function(err, orders){
            if(!orders){
                res.json({ message: 'orders invalid for this user' });
            }else{
                res.json({ message:'orders found',Orders : orders});
            }
        });
    }else if (type==='Shopkeeper'){
        Order.find({'shopKeeperId':req.body.userId },null, {sort: '-created_at'},function(err, orders){
            if(!orders){
                res.json({ message: 'orders invalid for this user' });
            }else{
                res.json({ message:'orders found', Orders : orders});
            }
        });
    }
});
router.route('/findOrdersNotDelivered')
.post(function(req, res){
    var orderStatusArray =['OrderReceived','OrderBeingProcessed','Delivering'];
    var type =req.body.usertype;
    if(type==='Customer'){
        Order.find({'customerId':req.body.userId ,currentState:{ $in : orderStatusArray }},null, {sort: '-created_at'},function(err, orders){
            if(!orders){
                res.json({ message: 'orders invalid for this user' });
            }
            else
            {
                var orderUserIds=[]
                for(var o=0;o<orders.length;o++){
                    orderUserIds.push(orders[o].shopKeeperId);
                }
                var userNumber=[];
                var userAddress=[];
                    User.find({ _id:{ $in :orderUserIds}},function(err, users){
                        if(!users){
                            console.log('not found');
                                res.json({ message:'orders found', Orders : orders});
                        }else{
                            for(var j=0; j<orderUserIds.length; j++){
                                for(var i=0 ; i<users.length;i++){
                                    if(orderUserIds[j]==users[i]._id){
                                        userNumber.push(users[i].phoneNumber);
                                        userAddress.push(users[i].address);
                                    }
                                }
                            }
                                res.json({ message:'orders found', Orders : orders, UserNumber:userNumber,UserAddress:userAddress});
                        }
                    });
            }
        });
    }else if (type==='Shopkeeper'){
        Order.find({'shopKeeperId':req.body.userId,currentState:{ $in : orderStatusArray } },null, {sort: '-created_at'},function(err, orders){
            if(!orders){
                res.json({ message: 'orders invalid for this user' });
            }else{
                var orderUserIds=[]
                for(var o=0;o<orders.length;o++){
                    orderUserIds.push(orders[o].customerId);
                }
                var userNumber=[];
                var userAddress=[];
                    User.find({ _id:{ $in :orderUserIds}},function(err, users){
                        if(!users){
                            console.log('not found');
                                res.json({ message:'orders found', Orders : orders});
                        }else{
                            for(var j=0; j<orderUserIds.length; j++){
                                for(var i=0 ; i<users.length;i++){
                                    if(orderUserIds[j]==users[i]._id){
                                        userNumber.push(users[i].phoneNumber);
                                        userAddress.push(users[i].address);
                                    }
                                }
                            }
                                res.json({ message:'orders found', Orders : orders, UserNumber:userNumber,UserAddress:userAddress});
                        }
                    });
            }
        });
    }
});

router.get('/productPicturesUpload', function(req, res){
    res.send('<form method="post" enctype="multipart/form-data" action="/api/profile">'
    + '<p>ProductId: <input type="text" name="productId" /></p>'
    + '<p>Image: <input type="file" name="image" /></p>'
    + '<p><input type="submit" value="Upload" /></p>'
    + '</form>');
});

router.post('/profile', upload.single('image'), function (req, res, next)
{
    console.log(req.body);
    console.log('file:'+req.file);
    var productId=req.body.productId || 'default';
    tmp_path = req.file.path;
    originalName=req.file.originalname;
    console.log(originalName);
    target_path =  req.file.path +'.' + getExtension(originalName);
    fs.rename(tmp_path, target_path, function(err) {
        if (err)
        throw err;
        // Delete the temporary file, so that the explicitly set temporary upload dir does not get filled with unwanted files.
        fs.unlink(tmp_path, function() {
            if (err)
            throw err;

            Product.findOne({_id:productId},function(err, product)
            {
                if (!product)
                {
                    res.json({error:'not found'});
                }else{
                    product.photoUrl = 'http://128.199.152.41:3000/' + path.basename(target_path);
                    console.log(product.photoUrl);
                    product.save(function(err)
                    {
                        if (err)
                        {
                            res.send(err);
                        }
                        res.json({ message: 'product photoUrl Updated', photoUrl : product.photoUrl});
                    });
                }
            });
        });
    });


});

app.use('/api', router);
app.listen(3000);
console.log('Magic happens on port 3000');
