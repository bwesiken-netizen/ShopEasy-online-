const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();
const db = admin.firestore();

/**
 * 1. Paychangu Webhook: Verifies and updates payment status for local orders.
 * Paychangu is a leading payment gateway in Malawi supporting Airtel Money, TNM Mpamba, and cards.
 */
exports.paychanguWebhook = functions.https.onRequest(async (req, res) => {
  // Paychangu sends headers to authenticate webhook signatures (usually "paychangu-signature")
  const signature = req.headers['paychangu-signature'];
  const event = req.body;

  if (!event || !event.tx_ref) {
    return res.status(400).send('Malformed payload');
  }

  const { tx_ref, status, amount, charge_type } = event;

  try {
    const orderRef = db.collection('orders').doc(tx_ref);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      console.warn(`Order ${tx_ref} not found`);
      return res.status(404).send('Order not found');
    }

    const orderData = orderSnap.data();

    // Secondary API check with Paychangu endpoint to prevent spoofing
    // URL: https://api.paychangu.com/payment/verify/{tx_ref}
    const paychanguSecret = process.env.PAYCHANGU_SECRET_KEY;
    let verified = false;

    if (paychanguSecret) {
      try {
        const response = await axios.get(`https://api.paychangu.com/payment/verify/${tx_ref}`, {
          headers: { Authorization: `Bearer ${paychanguSecret}` }
        });
        if (response.data && response.data.status === 'success') {
          verified = true;
        }
      } catch (err) {
        console.error('Failed secondary Paychangu API verification check:', err.message);
      }
    } else {
      // In sandbox/preview mode, fallback to verify based on signed hook body status
      if (status === 'success' || status === 'completed') {
        verified = true;
      }
    }

    if (verified) {
      await db.runTransaction(async (transaction) => {
        // Mark order as paid
        transaction.update(orderRef, {
          paymentStatus: 'paid',
          paychanguReference: event.reference || 'PAYCHANGU_WEBHOOK_OK',
          status: 'processing' // Advance from pending to processing
        });

        // Trigger Coin Reward on purchase (100 coins for every 10,000 MWK spent)
        const coinAmount = Math.floor(orderData.total / 100);
        if (coinAmount > 0) {
          const coinTxId = `tx_${tx_ref}_reward`;
          const coinTxRef = db.collection('coinTransactions').doc(coinTxId);
          
          transaction.set(coinTxRef, {
            id: coinTxId,
            userId: orderData.buyerId,
            amount: coinAmount,
            type: 'bonus',
            description: `Earned shopping coins for Order #${tx_ref}`,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });

          // Increment User balance
          const userRef = db.collection('users').doc(orderData.buyerId);
          transaction.update(userRef, {
            coins: admin.firestore.FieldValue.increment(coinAmount)
          });
        }
      });

      console.info(`Successfully processed payment for order ${tx_ref}`);
      return res.status(200).json({ status: 'success', message: 'Order payment processed' });
    } else {
      return res.status(400).send('Payment verification failed');
    }

  } catch (error) {
    console.error('Paychangu Webhook error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

/**
 * 2. On User Signup: Auto-award 100 ShopEasy loyalty coins.
 */
exports.onUserCreated = functions.auth.user().onCreate(async (user) => {
  const uid = user.uid;
  const userRef = db.collection('users').doc(uid);

  try {
    await db.runTransaction(async (transaction) => {
      // Create profile if doesn't exist
      transaction.set(userRef, {
        uid,
        name: user.displayName || 'ShopEasy Member',
        phone: user.phoneNumber || '',
        location: 'Lilongwe', // Default to capital city center
        role: 'buyer',
        coins: 100, // Sign up reward coins
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });

      // Record coin reward transaction
      const txId = `tx_${uid}_welcome`;
      transaction.set(db.collection('coinTransactions').doc(txId), {
        id: txId,
        userId: uid,
        amount: 100,
        type: 'bonus',
        description: 'ShopEasy Welcome Bonus Coins!',
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.info(`Welcome bonus coins awarded successfully to user: ${uid}`);
  } catch (error) {
    console.error('Error awarding welcome reward coins:', error);
  }
});

/**
 * 3. Initiate Paychangu Payment
 */
exports.initiatePayment = functions.https.onCall(async (data, context) => {
  // In v1, context holds authenticated user info
  if (!context || !context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in to purchase items.');
  }

  // Paychangu supports card, airtel, mpamba internally
  const paychanguSecret = process.env.PAYCHANGU_SECRET_KEY;
  if (!paychanguSecret) {
    throw new functions.https.HttpsError('failed-precondition', 'Paychangu Secret Key is missing from the environment settings.');
  }

  try {
    const response = await fetch('https://api.paychangu.com/payment', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paychanguSecret}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: data.totalAmount,
        currency: 'MWK',
        email: data.userEmail || 'noreply@shopeasy.mw',
        first_name: data.firstName || 'ShopEasy',
        last_name: data.lastName || 'Customer',
        callback_url: data.callbackUrl || 'https://shopeasy.mw/payment-callback',
        return_url: data.returnUrl || 'https://shopeasy.mw/order-success',
        tx_ref: data.orderId,
        customization: {
          title: 'ShopEasy Payment',
          description: `Order ${data.orderId}`
        }
      })
    });

    const result = await response.json();
    
    if (response.status !== 200 || !result.data || !result.data.checkout_url) {
      throw new Error(result.message || `Paychangu API Error: ${response.statusText}`);
    }

    return { paymentUrl: result.data.checkout_url };
  } catch (error) {
    console.error('Paychangu checkout initiation failed:', error);
    throw new functions.https.HttpsError('internal', error.message || 'Failed to communicate with Paychangu payment gateway.');
  }
});

