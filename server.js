const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const {
  initializeApp,
  cert,
  getApps
} = require("firebase-admin/app");

const {
  getFirestore
} = require("firebase-admin/firestore");

const {
  getMessaging
} = require("firebase-admin/messaging");

const fetch =
  (...args) =>
    import("node-fetch")
      .then(({ default: fetch }) => fetch(...args));

const app = express();

app.use(cors());
app.use(bodyParser.json());

/* =====================================================
   FIREBASE ADMIN / FCM
===================================================== */

let adminDb = null;
let adminMessaging = null;

function initFirebaseAdmin() {

  if (adminDb && adminMessaging) {
    return true;
  }

  try {

    const raw = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!raw) {

      console.warn(
        "FCM disabled: FIREBASE_SERVICE_ACCOUNT is not set."
      );

      return false;
    }

    if (!getApps().length) {

      const serviceAccount = JSON.parse(raw);

      if (serviceAccount.private_key) {

        serviceAccount.private_key =
          serviceAccount.private_key.replace(/\\n/g, "\n");
      }

      initializeApp({
        credential: cert(serviceAccount)
      });

    }

    adminDb = getFirestore();
    adminMessaging = getMessaging();

    console.log(
      "Firebase Admin / FCM ready."
    );

    return true;

  } catch (error) {

    console.error(
      "Firebase Admin initialization failed:",
      error.message
    );

    return false;
  }
}


/* =====================================================
   SEND NEW ORDER NOTIFICATION
===================================================== */

async function sendNewOrderNotification(order) {

  if (!initFirebaseAdmin()) {

    return {
      success: false,
      reason: "firebase-not-configured"
    };
  }

  try {

    const snapshot =
      await adminDb
        .collection("adminDevices")
        .get();

    const devices = [];

    snapshot.forEach((deviceDoc) => {

      const data = deviceDoc.data();

      if (
        data &&
        data.enabled !== false &&
        typeof data.token === "string" &&
        data.token.trim()
      ) {

        devices.push({
          docId: deviceDoc.id,
          token: data.token.trim()
        });

      }

    });


    if (!devices.length) {

      console.log(
        "FCM: no enabled admin devices found."
      );

      return {
        success: false,
        reason: "no-devices"
      };
    }


    /* Remove duplicate tokens */

    const uniqueDevices = [
      ...new Map(
        devices.map(
          (item) => [item.token, item]
        )
      ).values()
    ];


    /* Count ordered items */

    const itemCount =
      Array.isArray(order.items)
        ? order.items.reduce(
            (sum, item) =>
              sum + Number(item.qty || 0),
            0
          )
        : 0;


    const title =
      "🔔 NEW Khazaana ORDER";


    const body =
      `👤 ${order.customer || "Customer"} • ` +
      `₹${order.total ?? 0} • ` +
      `${itemCount} item${itemCount === 1 ? "" : "s"}`;


    const adminLink =
      "https://helpkhazaana-eng.github.io/khazaana---admin/";


    /* =================================================
       FCM MESSAGE
    ================================================= */

    const message = {

      notification: {

        title: title,

        body: body

      },


      /* Web Push specific notification */

      webpush: {

        notification: {

          title: title,

          body: body,

          icon:
            `${adminLink}icon.png`,

          badge:
            `${adminLink}icon.png`,

          requireInteraction: true

        },

        fcmOptions: {

          link: adminLink

        }

      },


      /* Extra order information */

      data: {

        type:
          "new_order",

        orderId:
          String(order.id),

        customer:
          String(order.customer || ""),

        phone:
          String(order.phone || ""),

        restaurant:
          String(order.restaurant || ""),

        total:
          String(order.total ?? ""),

        itemCount:
          String(itemCount),

        link:
          adminLink

      },


      /* Send to every registered admin device */

      tokens:
        uniqueDevices.map(
          (item) => item.token
        )

    };


    console.log(
      `FCM: attempting delivery to ` +
      `${uniqueDevices.length} device(s).`
    );


    const response =
      await adminMessaging
        .sendEachForMulticast(message);


    console.log(
      `FCM: ${response.successCount} sent, ` +
      `${response.failureCount} failed.`
    );


    /* =================================================
       LOG EVERY FAILURE
    ================================================= */

    response.responses.forEach(
      (result, index) => {

        if (!result.success) {

          console.error(
            `FCM token ${index + 1} failed:`,
            result.error?.code ||
              "unknown-error",

            result.error?.message ||
              ""
          );

        }

      }
    );


    /* =================================================
       DELETE INVALID TOKENS
    ================================================= */

    if (response.failureCount > 0) {

      const removals = [];

      response.responses.forEach(
        (result, index) => {

          if (!result.success) {

            const code =
              result.error?.code || "";


            if (
              code.includes(
                "registration-token-not-registered"
              ) ||
              code.includes(
                "invalid-registration-token"
              )
            ) {

              removals.push(

                adminDb
                  .collection("adminDevices")
                  .doc(
                    uniqueDevices[index].docId
                  )
                  .delete()
                  .catch(() => {})

              );

            }

          }

        }
      );


      await Promise.all(removals);

    }


    return {

      success:
        response.successCount > 0,

      successCount:
        response.successCount,

      failureCount:
        response.failureCount

    };


  } catch (error) {

    console.error(
      "FCM notification error:",
      error.message
    );


    return {

      success: false,

      reason:
        error.message

    };

  }

}


/* =====================================================
   ORDERS
===================================================== */

let orders = [];


/* =====================================================
   HOME
===================================================== */

app.get("/", (req, res) => {

  res.send(
    "Khazaana Backend Running 🚀"
  );

});


/* =====================================================
   FCM STATUS / TEST
===================================================== */

app.get("/fcm-status", async (req, res) => {

  try {

    if (!initFirebaseAdmin()) {

      return res.status(500).json({

        success: false,

        configured: false,

        reason:
          "FIREBASE_SERVICE_ACCOUNT is not configured correctly."

      });

    }


    const snapshot =
      await adminDb
        .collection("adminDevices")
        .get();


    const devices = [];


    snapshot.forEach((deviceDoc) => {

      const data =
        deviceDoc.data();


      if (
        data &&
        data.enabled !== false &&
        typeof data.token === "string" &&
        data.token.trim()
      ) {

        devices.push({

          id:
            deviceDoc.id,

          platform:
            data.platform ||
            "unknown",

          lastSeen:
            data.lastSeen ||
            null

        });

      }

    });


    res.json({

      success: true,

      configured: true,

      enabledDevices:
        devices.length,

      devices:
        devices

    });


  } catch (error) {

    console.error(
      "FCM status error:",
      error.message
    );


    res.status(500).json({

      success: false,

      error:
        error.message

    });

  }

});


/* =====================================================
   PLACE ORDER
===================================================== */

app.post(
  "/place-order",
  async (req, res) => {

    const order = {

      id:
        Date.now(),

      status:
        "Pending",

      date:
        new Date().toLocaleString(),

      customer:
        req.body.customer,

      phone:
        req.body.phone,

      address:
        req.body.address,

      items:
        req.body.items,

      subtotal:
        req.body.subtotal,

      delivery:
        req.body.delivery,

      total:
        req.body.total,

      payment:
        req.body.payment,

      restaurant:
        req.body.restaurant,

      coupon:
        req.body.coupon

    };


    orders.unshift(order);


    console.log(
      "NEW ORDER:",
      order
    );


    /*
      Notification failure must NEVER
      make the order fail.
    */

    const notification =
      await sendNewOrderNotification(
        order
      );


    res.json({

      success: true,

      notification:
        notification

    });

  }
);


/* =====================================================
   GET ORDERS
===================================================== */

app.get(
  "/orders",
  (req, res) => {

    res.json(orders);

  }
);


/* =====================================================
   UPDATE STATUS
===================================================== */

app.post(
  "/update-status",
  (req, res) => {

    const {
      id,
      status
    } = req.body;


    const order =
      orders.find(
        (o) => o.id == id
      );


    if (order) {

      order.status =
        status;

    }


    res.json({

      success: true

    });

  }
);


/* =====================================================
   DELETE ORDER
===================================================== */

app.post(
  "/delete-order",
  (req, res) => {

    const {
      id
    } = req.body;


    orders =
      orders.filter(
        (o) => o.id != id
      );


    res.json({

      success: true

    });

  }
);


/* =====================================================
   SEND WHATSAPP
===================================================== */

app.post(
  "/send-whatsapp",
  async (req, res) => {

    try {

      const {
        templateName,
        mobile
      } = req.body;


      const response =
        await fetch(

          "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",

          {

            method:
              "POST",

            headers: {

              "Content-Type":
                "application/json",

              "authkey":
                "519145Ar0WLBVY6a11b6f8P1"

            },

            body:
              JSON.stringify({

                integrated_number:
                  "918695902696",

                content_type:
                  "template",

                payload: {

                  messaging_product:
                    "whatsapp",

                  type:
                    "template",

                  template: {

                    name:
                      templateName,

                    language: {

                      code:
                        "en",

                      policy:
                        "deterministic"

                    },

                    namespace:
                      "f936a632_2e2a_46a8_a685_4de5ad090308",

                    to_and_components: [

                      {

                        to: [
                          "91" + mobile
                        ],

                        components: {}

                      }

                    ]

                  }

                }

              })

          }

        );


      const data =
        await response.json();


      console.log(
        "WHATSAPP RESPONSE:",
        data
      );


      res.json(data);


    } catch (err) {

      console.log(
        "WHATSAPP ERROR:",
        err
      );


      res.status(500).json({

        error:
          err.message

      });

    }

  }
);


/* =====================================================
   START SERVER
===================================================== */

const PORT =
  process.env.PORT || 3000;


app.listen(
  PORT,
  () => {

    console.log(
      `Server running on port ${PORT}`
    );

  }
);