

const express = require('express');
const ejs = require('ejs');
const paypal = require('paypal-rest-sdk');
const bodyParser = require('body-parser')
global.fetch = require('node-fetch')
const app = express();
const port = process.env.PORT || 3000;
//const API_URL = 'http://192.168.1.29:3001'
const API_URL = 'https://sura-ticket-manager.herokuapp.com'



paypal.configure({
    'mode': 'live', //sandbox or live 
    'client_id': 'AdtK8W9DYvGqF1c43unQrApw75WQuqw8cyO_gjqRUHb7vwTjgRHMA-TbkTZcWNOrm0vE7kkp9xOhlib1', // please provide your client id here 
    'client_secret': 'EAqNVP5EJr4IUUTDDxMmbX7k4VisJFlqtV4m7doYkSpyDDqA2mkCR6TlSunTAw_AcIYhDj8kFK9yBa_E' // provide your client secret here 
  });

app.use(bodyParser.urlencoded({extended:true}))
app.use('/public', express.static(process.cwd() + '/public'));

app.set('view engine', 'ejs');



  // all gigs

  app.get('/', async (req, res) => {
    //console.log("MAIN");
    const houseNo = req.params.houseNo
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
    res.render('pages/home', { gigs: gigs })
    
  })


 
app.post('/buy', (req,res) => {
  const gigId = req.body.id
  const gigFeeEur= req.body.feeEur
  const gigHouseNo = req.body.houseNo
  const gigVenueAddress = req.body.venueAddress
  const gigTitle = req.body.title
  const gigPerformerName = req.body.performerName
  const gigAvailableSeats = req.body.availableSeats
  res.render('pages/buy', {
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
  global.ticketAmount = parseInt(req.body.amount)
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
        //"return_url": `http://192.168.1.16:3000/success`,
        //"cancel_url": `http://192.168.1.16:3000/cancel`
      
        "return_url": `https://stormy-ocean-23870.herokuapp.com/success`,
        "cancel_url": `https://stormy-ocean-23870.herokuapp.com/cancel`
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
          "description": `Ticket f. Haus Nr. ${gigHouseNo}`
      }]
    };
    
    
    paypal.payment.create(create_payment_json, function (error, payment) {
        if (error) {
            console.log("Payment-creation ERROR");
            //throw error;
            res.render('pages/message', { message: 'Es hat nicht funktioniert, es wurden keine Tickets erworben!' })

        } else {
            //console.log("Create Payment Response");
            //console.log(payment);
            for(var i=0; i < payment.links.length; i++) {
                if (payment.links[i].rel === 'approval_url') {
                    res.redirect(payment.links[i].href);
                }
            }
        }
    });

  } else {
    console.log("HTTP-Error: " + response.status + "   Or suddenly sold Out");
    res.render('pages/message', { message: 'Es hat nicht funktioniert, es wurden keine Tickets erworben!' })
  }  
})

app.get('/success', async (req, res) => {
  //console.log("SUCCESS");
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
    paypal.payment.execute(paymentId, execute_payment_json, async (error, payment) => {

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
              console.log("Payment-creation ERROR");
              res.render('pages/message', { message: 'Es hat nicht funktioniert, es wurden keine Tickets erworben!' })

            } else {
              console.log("HTTP-Error: " + response.status);
              res.render('pages/message', { message: 'Es hat nicht funktioniert, es wurden keine Tickets erworben!' })
            }  
                    //throw error;
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
              res.render('pages/message', { message: `${ticketAmount} Ticket(s) wurden erfolgreich erworben und werden an der Abendkasse hinterlegt` })
            } else {
              res.render('pages/message', { message: 'Something went wrong, contact info@germanscreens.de' })
            }  
            
        }
    });
})


app.get('/cancel', async (req, res) => {
  //console.log("CANCEL");
  const body = { amount: ticketAmount * (-1), buyer: buyer  };
            const response = await fetch(`${API_URL}/gigs_buy/${gigId}`, {
              method: 'patch',
              body:    JSON.stringify(body),
              headers: { 'Content-Type': 'application/json' },
            });
            if (response.ok) { // if HTTP-status is 200-299
              console.log("Paypal CANCELLED");
              res.render('pages/message', { message: 'Es hat nicht funktioniert, es wurden keine Tickets erworben!' })

            } else {
              console.log("HTTP-Error: " + response.status);
              res.render('pages/message', { message: 'Es hat nicht funktioniert, es wurden keine Tickets erworben!' })
            }  
    //res.send('Cancelled')
}) 

// one gig

app.get('/:houseNo', async (req, res) => {
  const houseNo = req.params.houseNo
  const response = await fetch(`${API_URL}/gigs`, {method: "GET"});
  var gigs=[];
  if (response.ok) { // if HTTP-status is 200-299
    // get the response body (the method explained below)
    gigs = await response.json();

  } else {
    console.log("HTTP-Error: " + response.status);
  }  

  // render `home.ejs` with the list of posts
  res.render('pages/home', { gigs: gigs.filter( gig => gig.houseNo == houseNo ) })
  
})


app.listen(port, () => console.log('Server started on port ', port));


// alphabetical sort function
var sort_by = (field, reverse, primer) => {

  var key = primer ? 
      (x) => {return primer(x[field])} : 
      (x) => {return x[field]};

  reverse = !reverse ? 1 : -1;

  return (a, b) => {
      return a = key(a), b = key(b), reverse * ((a > b) - (b > a));
    } 
}