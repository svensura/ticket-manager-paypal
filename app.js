const express = require('express');
const ejs = require('ejs');
const paypal = require('paypal-rest-sdk');
const bodyParser = require('body-parser')
global.fetch = require('node-fetch')
const app = express();
const port = 3000;
const API_URL = 'http://192.168.1.29:3001'



paypal.configure({
    'mode': 'sandbox', //sandbox or live 
    'client_id': 'AblAraG-7OvD-xecbqFX6JzsOyIRoX0jll-96KDZe0inobJvb3IfPEzYjTpm_GB-IHOT_YrvsPVWjS_p', // please provide your client id here 
    'client_secret': 'EBLpSeURLONVjzATT_xTG59fJuZ94CHDyJvaE8fz5MLq6YtGWpfiVfJgf2jCAQ2BVASk4Z_IX6sLI2AE' // provide your client secret here 
  });

app.use(bodyParser.urlencoded({extended:true}))

app.set('view engine', 'ejs');

// blog home page
app.get('/', async (req, res) => {

    const response = await fetch(`${API_URL}/gigs`, {method: "GET"});
    var gigs=[];
    if (response.ok) { // if HTTP-status is 200-299
      // get the response body (the method explained below)
      gigs = await response.json();
      gigs.sort(sort_by('houseNo'));
      

    } else {
      console.log("HTTP-Error: " + response.status);
    }  
  
    // render `home.ejs` with the list of posts
    res.render('home', { gigs: gigs })
    
  })

  // blog post
  app.get('/post/:id', (req, res) => {
    // find the post in the `posts` array
    const post = posts.filter((post) => {
      return post.id == req.params.id
    })[0]
    // render the `post.ejs` template with the post content
    res.render('post', {
      author: post.author,
      title: post.title,
      body: post.body
    })
  })



app.post('/buy', (req,res) => {
  const gigId = req.body.id
  const gigFeeEur= req.body.feeEur
  const gigHouseNo = req.body.houseNo
  const gigVenueAddress = req.body.venueAddress
  const gigTitle = req.body.title
  const gigPerformerName = req.body.performerName
  const gigAvailableSeats = req.body.availableSeats
  res.render('buy', {
    error: null,
    id: gigId,
    houseNo: gigHouseNo,
    venueAddress: gigVenueAddress,
    title: gigTitle,
    performerName: gigPerformerName,
    feeEur: gigFeeEur,
    availableSeats: gigAvailableSeats
  })
})
  


app.post('/pay', async (req,res) => {
    global.gigId = req.body.id
    const gigFeeEur= req.body.feeEur
    const gigHouseNo = req.body.houseNo
    global.ticketAmount = req.body.ticketAmount
    global.buyer = req.body.buyer
    // console.log('gigId: ',gigId )
    // console.log('gigFeeEur: ',gigFeeEur )
    // console.log('gigHouseNo: ',gigHouseNo )
    // console.log('ticketAmount: ',ticketAmount )
    global.feeEur = gigFeeEur * ticketAmount
    const response = await fetch(`${API_URL}/gigs/${gigId}`, {method: "GET"});
    gig = await response.json();
    if (response.ok && gig.startSeats - gig.soldSeats >= ticketAmount) { // if HTTP-status is 200-299
      // get the response body (the method explained below)
      const create_payment_json = {
        "intent": "sale",
        "payer": {
            "payment_method": "paypal"
        },
        "redirect_urls": {
            "return_url": "http://192.168.1.29:3000/success",
            "cancel_url": "http://192.168.1.29:3000/cancel"
        },
        "transactions": [{
            "item_list": {
                "items": [{
                    "name": `Ticket for House No. ${gigHouseNo}`,
                    "sku": "001",
                    "price": `${gigFeeEur}`,
                    "currency": "EUR",
                    "quantity": `${ticketAmount}`
                }]
            },
            "amount": {
                "currency": "EUR",
                "total": `${feeEur}`
            },
            "description": `Tiocket for House No. ${gigHouseNo}`
        }]
      };
    
    
      paypal.payment.create(create_payment_json, function (error, payment) {
          if (error) {
              console.log("ERROR");
              throw error;
          } else {
              // console.log("Create Payment Response");
              // console.log(payment);
              for(var i=0; i < payment.links.length; i++) {
                  if (payment.links[i].rel === 'approval_url') {
                      res.redirect(payment.links[i].href);
                  }
              }
          }
      });

    } else {
      console.log("HTTP-Error: " + response.status + "   Or suddenly sold Out");
      res.render('message', { message: 'Something went wrong, no tickets were purchased' })
    }  
  

    

})

app.get('/success', async (req, res) => {
  // console.log("SUCCESS");
  const body = { amount: ticketAmount, buyer: buyer  };
    const response = await fetch(`${API_URL}/gigs_buy/${gigId}`, {
      method: 'patch',
      body:    JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    });
  const payerId = req.query.PayerID;
  const paymentId = req.query.paymentId
  const execute_payment_json = {
    "payer_id": payerId,
    "transactions": [{
      "amount": {
        "currency": "EUR",
        "total": `${feeEur}`
        }
      }]
    };
    paypal.payment.execute(paymentId, execute_payment_json, async function (error, payment) {

        // payment failed
        if (error) {
            // console.log(error.response);
            //res.send('Something went wrong, no tickets were purchased')
            const body = { amount: ticketAmount * (-1), buyer: buyer  };
            const response = await fetch(`${API_URL}/gigs_buy/${gigId}`, {
              method: 'patch',
              body:    JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) { // if HTTP-status is 200-299
              res.render('message', { message: 'Something went wrong, no tickets were purchased' })

            } else {
              console.log("HTTP-Error: " + response.status);
            }  
                    throw error;
        // payment went through   
        } else {
            // console.log("Get Payment Response");
            // console.log(JSON.stringify(payment));
            const body = { amount: ticketAmount, buyer: buyer  };
            const response = await fetch(`${API_URL}/gigs_ticket/${gigId}`, {
              method: 'patch',
              body:    JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) { // if HTTP-status is 200-299
              // get the response body (the method explained below)
              res.render('message', { message: `${ticketAmount} ticket(s) were successfully purchased` })
            } else {
              res.render('message', { message: 'Something went wrong, contact info@germanscreens.de' })
            }  
            
        }
    });
})


app.get('/cancel', async (req, res) => {
  const body = { amount: ticketAmount * (-1), buyer: buyer  };
            const response = await fetch(`${API_URL}/gigs_buy/${gigId}`, {
              method: 'patch',
              body:    JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) { // if HTTP-status is 200-299
              res.render('message', { message: 'Something went wrong, no tickets were purchased' })

            } else {
              // console.log("HTTP-Error: " + response.status);
            }  
    //res.send('Cancelled')
}) 


app.listen(port, () => console.log('Server started on port ', port));


// alphabetical sort function
var sort_by = function(field, reverse, primer){

  var key = primer ? 
      function(x) {return primer(x[field])} : 
      function(x) {return x[field]};

  reverse = !reverse ? 1 : -1;

  return function (a, b) {
      return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    } 
}