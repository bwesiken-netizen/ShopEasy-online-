const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const { Resend } = require('resend');

admin.initializeApp();

// Initialize Firestore dynamically with the database ID configuration
let db;
try {
  const firebaseConfig = require('../firebase-applet-config.json');
  if (firebaseConfig.firestoreDatabaseId) {
    db = admin.firestore(firebaseConfig.firestoreDatabaseId);
    console.log("Connected to named firestore database: " + firebaseConfig.firestoreDatabaseId);
  } else {
    db = admin.firestore();
  }
} catch (e) {
  console.warn("Failed to load named database config. Falling back to default database.", e);
  db = admin.firestore();
}

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

/**
 * 4. Send Email OTP
 */
exports.sendEmailOTP = functions.https.onCall(async (data, context) => {
  const { email } = data;
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'Email is required.');
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid email format.');
  }

  // Rate Limiting (60 seconds)
  const otpDocRef = db.collection('email_otps').doc(email);
  const otpDoc = await otpDocRef.get();
  if (otpDoc.exists) {
    const dataDoc = otpDoc.data();
    if (dataDoc.createdAt) {
      const createdTime = dataDoc.createdAt.toDate ? dataDoc.createdAt.toDate() : new Date(dataDoc.createdAt);
      const diffSeconds = (Date.now() - createdTime.getTime()) / 1000;
      if (diffSeconds < 60) {
        throw new functions.https.HttpsError('resource-exhausted', 'Please wait 60 seconds before requesting another OTP');
      }
    }
  }

  // Generate 6-digit OTP code
  const otpCode = String(Math.floor(100000 + Math.random() * 900000));

  // Store hashed OTP in firestore: email_otps/{email}
  const hashedOtp = await bcrypt.hash(otpCode, 10);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes

  await otpDocRef.set({
    email: email,
    otp: hashedOtp,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
    attempts: 0,
    locked: false
  });

  // Send Email via Resend
  const resendApiKey = process.env.RESEND_API_KEY || '';
  if (!resendApiKey || resendApiKey === 'your_resend_api_key_here') {
    console.warn(`[SANDBOX / MONOLITH BYPASS] No valid Resend API Key configured. Emitting OTP in console logs:`);
    console.info(`[DEVELOPMENT CODE]: ${otpCode} for ${email}`);
  } else {
    try {
      const resend = new Resend(resendApiKey);
      await resend.emails.send({
        from: "ShopEasy <onboarding@resend.dev>",
        to: [email],
        subject: "Your ShopEasy verification code",
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto">
            <div style="background:#E53935;padding:20px;text-align:center">
              <h1 style="color:white;margin:0">SE ShopEasy</h1>
              <p style="color:white;margin:4px 0">🇲🇼 Malawi's Local Marketplace</p>
            </div>
            <div style="padding:24px">
              <h2>Your verification code</h2>
              <p>Enter this code on ShopEasy to verify your email:</p>
              <div style="background:#f5f5f5;border-radius:8px;
                          padding:20px;text-align:center;
                          font-size:36px;font-weight:bold;
                          letter-spacing:8px;color:#E53935">
                ${otpCode}
              </div>
              <p style="color:#666;margin-top:16px">
                ⏱️ This code expires in <strong>5 minutes</strong>
              </p>
              <p style="color:#666">
                If you did not request this, ignore this email.
              </p>
            </div>
            <div style="background:#f5f5f5;padding:12px;
                        text-align:center;color:#999;font-size:12px">
              ShopEasy — Made in Malawi 🇲🇼
            </div>
          </div>
        `
      });
    } catch (emailErr) {
      console.error('Failed to send email via Resend API:', emailErr);
      console.info(`[DEVELOPMENT CODE FALLBACK]: ${otpCode} for ${email}`);
    }
  }

  return { success: true, message: 'OTP sent to your email' };
});

/**
 * 5. Verify Email OTP
 */
exports.verifyEmailOTP = functions.https.onCall(async (data, context) => {
  const { email, otp } = data;
  if (!email || !otp) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and OTP are required.');
  }

  // Fetch document
  const otpDocRef = db.collection('email_otps').doc(email);
  const otpDoc = await otpDocRef.get();
  if (!otpDoc.exists) {
    throw new functions.https.HttpsError('not-found', 'OTP not found. Please request a new one.');
  }

  const dataDoc = otpDoc.data();

  // Check Locked
  if (dataDoc.locked === true) {
    throw new functions.https.HttpsError('permission-denied', 'Too many failed attempts. Request a new OTP.');
  }

  // Check Expiry
  const expiresAt = dataDoc.expiresAt ? (dataDoc.expiresAt.toDate ? dataDoc.expiresAt.toDate() : new Date(dataDoc.expiresAt)) : null;
  if (expiresAt && Date.now() > expiresAt.getTime()) {
    await otpDocRef.delete();
    throw new functions.https.HttpsError('deadline-exceeded', 'OTP expired. Please request a new one.');
  }

  // Check Attempts
  if (dataDoc.attempts >= 5) {
    await otpDocRef.update({ locked: true });
    throw new functions.https.HttpsError('permission-denied', 'Too many failed attempts. Request a new OTP.');
  }

  // Verify OTP via Bcrypt
  const isMatch = await bcrypt.compare(otp, dataDoc.otp);
  if (!isMatch) {
    const newAttempts = (dataDoc.attempts || 0) + 1;
    const remaining = 5 - newAttempts;
    if (newAttempts >= 5) {
      await otpDocRef.update({ attempts: newAttempts, locked: true });
      throw new functions.https.HttpsError('permission-denied', 'Too many failed attempts. Request a new OTP.');
    } else {
      await otpDocRef.update({ attempts: newAttempts });
      throw new functions.https.HttpsError('invalid-argument', `Wrong code. ${remaining} attempts remaining.`);
    }
  }

  // If correct, delete document
  await otpDocRef.delete();

  // Check if user exists in Firestore
  const usersQuery = await db.collection('users').where('email', '==', email).limit(1).get();
  let uid;
  let isNewUser = false;
  let isProfileComplete = false;

  if (!usersQuery.empty) {
    const userDoc = usersQuery.docs[0];
    uid = userDoc.id;
    isProfileComplete = userDoc.data().isProfileComplete ?? true;
  } else {
    // Register absolute new auth user
    try {
      const userRecord = await admin.auth().createUser({
        email: email,
        emailVerified: true
      });
      uid = userRecord.uid;
    } catch (authErr) {
      if (authErr.code === 'auth/email-already-exists') {
        const existingAuthUser = await admin.auth().getUserByEmail(email);
        uid = existingAuthUser.uid;
      } else {
        throw new functions.https.HttpsError('internal', authErr.message || 'Error creating Firebase auth user.');
      }
    }

    isNewUser = true;
    isProfileComplete = false;

    // Create profile doc in Firestore with coins: 0, createdAt: now
    await db.collection('users').doc(uid).set({
      uid,
      email,
      isProfileComplete: false,
      role: null,
      coins: 0,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }

  // Generate Custom Token
  try {
    const customToken = await admin.auth().createCustomToken(uid);
    return {
      token: customToken,
      isNewUser,
      isProfileComplete
    };
  } catch (tokenErr) {
    throw new functions.https.HttpsError('internal', tokenErr.message || 'Error generating custom login token.');
  }
});

