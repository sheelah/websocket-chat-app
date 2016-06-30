# Websocket Chat App

## Running

First `npm install` to grab all the necessary dependencies.

Then run `npm start` and open <localhost:3000> in your browser.

## Overview

A chat app using Socket.IO. Visitors queue up to chat.

## Endpoints (/)

/: Visitors enter the queue
/operator: operator enters to chat with visitors

## Assumptions
* Only one operator will attempt to log in at any given time.
* If the operator disconnects, all remaining visitor sessions are closed.
* No visitors have been talked to yet when an operator joins.
