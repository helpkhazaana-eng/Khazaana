const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();

app.use(cors());
app.use(bodyParser.json());

let orders = [];

/* HOME */

app.get("/", (req, res) => {

  res.send("Khazaana Backend Running 🚀");

});

/* PLACE ORDER */

app.post("/place-order", (req, res) => {

  const order = {

    id: Date.now(),

    status: "Pending",

    date: new Date().toLocaleString(),

    customer: req.body.customer,

    phone: req.body.phone,

    address: req.body.address,

    items: req.body.items,

    subtotal: req.body.subtotal,

    delivery: req.body.delivery,

    total: req.body.total,

    payment: req.body.payment,

    restaurant: req.body.restaurant,

    coupon: req.body.coupon

  };

  orders.unshift(order);

  console.log("NEW ORDER:", order);

  res.json({
    success: true
  });

});

/* GET ORDERS */

app.get("/orders", (req, res) => {

  res.json(orders);

});

/* UPDATE STATUS */

app.post("/update-status", (req, res) => {

  const { id, status } = req.body;

  const order =
  orders.find(o => o.id == id);

  if(order){

    order.status = status;
  }

  res.json({
    success:true
  });

});

/* DELETE ORDER */

app.post("/delete-order", (req, res) => {

  const { id } = req.body;

  orders =
  orders.filter(o => o.id != id);

  res.json({
    success:true
  });

});

const PORT = 3000;

app.listen(PORT, () => {

  console.log(
    "Server running on port 3000"
  );

});