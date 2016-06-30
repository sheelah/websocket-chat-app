var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

var visitors = [];
var visitorNames = {};
var operator = null;
var operatorChattingWith = null;

var removeVisitor = function(socketId) {
  var position = getVisitorPosition(socketId);
  if (position === -1) {
    return;
  }
  visitors.splice(position, 1);
  delete visitorNames[socketId];
};

var addVisitor = function(socketId, name) {
  visitors.push(socketId);
  visitorNames[socketId] = name;
};

var getVisitorPosition = function(socketId) {
  return visitors.indexOf(socketId);
}

var removeOperator = function(socketId) {
  operator = null;
};

var addOperator = function(socketId) {
  operator = socketId;
};

var handleVisitorDisconnect = function(socket) {
  // If this was the current active chat target, move on to next visitor.
  if (operatorChattingWith === socket.id) {
    var newVisitorPosition = getVisitorPosition(socket.id) + 1;
    operatorChattingWith = visitors[newVisitorPosition] || null;

    // Tell next user they're up
    if (operatorChattingWith) {
      socket.to(operatorChattingWith).emit('update-operator-status', true);
      socket.to(operatorChattingWith).emit(
        'update-visitor-queue', getVisitorPosition(operatorChattingWith)
      );
    }
  }
  removeVisitor(socket.id);
  socket.to(operator).emit(
    'update-chatting-with', operatorChattingWith, visitorNames
  );
  socket.to(operator).emit('update-visitors-list', visitors, visitorNames);

};

var handleOperatorDisconnect = function(socket) {
  removeOperator(socket.id);
  operatorChattingWith = null;
  io.emit('update-operator-status', false);
  io.emit('chat-ended', 'The operator has ended this session.');
};

var updateVisitorQueuePosition = function(socket, visitors) {
  visitors.forEach(function(visitor) {
    return socket.to(visitor).emit(
      'update-visitor-queue', getVisitorPosition(visitor)
    );
  });
};

// Static assets
app.use('/css', express.static(__dirname + '/public/css'));

// Routes
app.get('/', function(req, res) {
    res.sendFile(__dirname + '/index.html');
});

app.get('/operator', function(req, res) {
    res.sendFile(__dirname + '/operator.html');
});

// Event handling
io.on('connection', function(socket) {

    socket.on('disconnect', function() {
      if (socket.id === operator) {
        // Operator disconnected
        handleOperatorDisconnect(socket);

      } else {
        // Visitor disconnected
        handleVisitorDisconnect(socket);
        updateVisitorQueuePosition(socket, visitors);
      }
    });

    socket.on('visitor-joined-chat', function(name) {
      addVisitor(socket.id, name);
      if (getVisitorPosition(socket.id) === 0 && operator) {
        // Start chat with this visitor
        socket.emit('update-operator-status', true);
        operatorChattingWith = socket.id;
        socket.to(operator).emit(
          'update-chatting-with', operatorChattingWith, visitorNames
        );
      }
      socket.emit('update-visitor-queue', getVisitorPosition(socket.id));
      socket.to(operator).emit('update-visitors-list', visitors, visitorNames);
    });

    socket.on('operator-joined-chat', function() {
      addOperator(socket.id);
      socket.to(visitors[0]).emit('update-operator-status', true);
      operatorChattingWith = visitors[0];
      socket.emit('update-chatting-with', operatorChattingWith, visitorNames);
      socket.emit('update-visitors-list', visitors, visitorNames);
    });

    socket.on('message-to-operator', function(message) {
      // Send message operator and visitor
      socket.to(operator).emit(
        'message-to-operator', visitorNames[socket.id], message
      );
      socket.emit('message-to-operator', visitorNames[socket.id], message);
    });

    socket.on('message-to-visitor', function(message) {
      if (message !== '!next') {
        // Send message to the visitor and operator
        socket.to(operatorChattingWith).emit(
          'message-to-visitor', 'operator', message
        );
        socket.emit('message-to-visitor', 'operator', message);
        return;
      }

      // If message was '!next', go to next visitor in queue
      var previousActiveVisitor = operatorChattingWith;

      // Update current value of who operator is chatting with
      var newVisitorPosition = getVisitorPosition(previousActiveVisitor) + 1;
      operatorChattingWith = visitors[newVisitorPosition] || null;
      socket.to(previousActiveVisitor).emit('update-operator-status', false);
      socket.to(previousActiveVisitor).emit(
        'chat-ended', 'The operator has ended this session.'
      );
      socket.emit(
        'chat-ended', 'You have ended the chat with '
        + visitorNames[previousActiveVisitor]);
      removeVisitor(previousActiveVisitor);
      socket.emit('update-visitors-list', visitors, visitorNames);
      socket.emit('update-chatting-with', operatorChattingWith, visitorNames);

      // Tell next user they're up if user exists
      if (operatorChattingWith) {
        socket.to(operatorChattingWith).emit('update-operator-status', true);
        socket.to(operatorChattingWith).emit(
          'update-visitor-queue', getVisitorPosition(operatorChattingWith)
        );
        updateVisitorQueuePosition(socket, visitors);
      }
    });
});

http.listen(3000, function() {
    console.log('listening on *:3000');
});

