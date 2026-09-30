/* Configuração ÚNICA do Firebase (módulo). Todas as páginas importam daqui. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA2Kz1hwQM8HplqtIPM6GMBSX-aroExg0w",
  authDomain: "biblioteca-virtual-8db41.firebaseapp.com",
  databaseURL: "https://biblioteca-virtual-8db41-default-rtdb.firebaseio.com",
  projectId: "biblioteca-virtual-8db41",
  storageBucket: "biblioteca-virtual-8db41.firebasestorage.app",
  messagingSenderId: "247188034497",
  appId: "1:247188034497:web:29d31ef65693d5d85e5540",
  measurementId: "G-6F9T86KGZ3"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
