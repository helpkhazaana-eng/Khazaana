// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB_UiPI_NKsbMWrmqCh26t_L7lBbRRw3GE",
  authDomain: "khazaana-7088c.firebaseapp.com",
  projectId: "khazaana-7088c",
  storageBucket: "khazaana-7088c.firebasestorage.app",
  messagingSenderId: "988898941531",
  appId: "1:988898941531:web:851a3d3db24c85e9fa3d7e",
  measurementId: "G-TPE4BVCTDT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);