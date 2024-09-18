import React from "react";
import ReactDOM from "react-dom/client";
import {
  createBrowserRouter,
  RouterProvider,
} from "react-router-dom";
import "./index.css";
import { EventType, PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";
import Home from "./routes/home";
import Authenticated from "./routes/authenticated";
import Admin from "./routes/admin";
import Beast from "./routes/beast";

const msalInstance = new PublicClientApplication(msalConfig);

// Default to using the first account if no account is active on page load
if (!msalInstance.getActiveAccount() && msalInstance.getAllAccounts().length > 0) {
    // Account selection logic is app dependent. Adjust as needed for different use cases.
    msalInstance.setActiveAccount(msalInstance.getActiveAccount()[0]);
}

// Listen for sign-in event and set active account
msalInstance.addEventCallback((event) => {
    if (event.eventType === EventType.LOGIN_SUCCESS && event.payload.account) {
        const account = event.payload.account;
        msalInstance.setActiveAccount(account);
    }
});

const router = createBrowserRouter([
  {
    path: "/",
    element: <Home instance={msalInstance}/>,
  },
  {
    path: "/authenticated",
    element: <Authenticated/>,
  },
  {
    path: "/admin",
    element: <Admin/>,
  },
  {
    path: "/beast",
    element: <Beast/>,
  }
]);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <RouterProvider router={router} instance={msalInstance}/>
  </React.StrictMode>
);