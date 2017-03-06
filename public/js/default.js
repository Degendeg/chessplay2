var serverGame;
var und, res;
var username, playerColor;
var game, board;
var usersOnline = [];
var myGames = [];
var socket = window.io.connect({
  transports: ['websocket']
});

//////////////////////////////
// Socket.io handlers
//////////////////////////////
socket.on('login', function(msg) {
  usersOnline = msg.users;
  updateUserList();

  myGames = msg.games;
  updateGamesList();
});

socket.on('joinlobby', function(msg) {
  addUser(msg);
});

socket.on('leavelobby', function(msg) {
  removeUser(msg);
});

socket.on('joingame', function(msg) {
  console.log("joined as game id: " + msg.game.id);
  playerColor = msg.color;
  initGame(msg.game);

  $('#page-lobby').hide();
  $('#page-game').show();
  $('#chat-game').show();
});

socket.on('move', function(msg) {
  if (serverGame && msg.gameId === serverGame.id) {
    game.move(msg.move);
    board.position(game.fen());
    updateStatus();
  }
});

$('#takeback-btn').click(function() {
  socket.emit('undo', und);
  $(this).prop('disabled', true);
});

$('#reset-btn').click(function() {
  socket.emit('reset', res);
});

socket.on('undo', function() {
  game.undo();
  board.position(game.fen());
  updateStatus();
});

socket.on('reset', function() {
  game.reset();
  board.position(game.fen());
  updateStatus();
});

socket.on('logout', function(data) {
  $('#alert').text('Player disconnected from the game.').show().delay(3000).fadeOut();
});

socket.on('logout', function(msg) {
  removeUser(msg.username);
});

// chat
$("#inputSend").on('click', function(e) {
	e.preventDefault();
    socket.emit('chat message', $('#inputText').val(), username);
	$('#inputText').val('');
});

// send messages by appending new li working as message
socket.on('chat message', function(msg) {
  $(".messages").append('<div class="message"><div class="content from-you"><p>' + msg.username + ': ' + msg.message + '</p></div></div>');
  $(".messages").animate({
		scrollTop: $(".messages").height()
  }, 500);
});

//////////////////////////////
// Menus
////////////////////////////// 
$('#login').on('click', function() {
  username = $('#username').val();

  if (username.length > 0) {
    $('#userLabel').text(username);
    socket.emit('login', username);

    $('#page-login').hide();
    $('#page-lobby').show();
  }
});

$('#game-back').on('click', function() {
  socket.emit('login', username);

  $('#page-game').hide();
  $('#chat-game').hide();
  $('#page-lobby').show();
});

$('#game-resign').on('click', function() {
  $("#myModal").modal();
});

$('#yes-modal-btn').on('click', function() {
  socket.emit('resign', {
	userId: username,
	gameId: serverGame.id
  });

  $('#myModal').modal('hide');
  $('#chat-game').hide();
  $('#page-game').hide();
  $('#page-lobby').show();
});

var addUser = function(userId) {
  usersOnline.push(userId);
  updateUserList();
};

var removeUser = function(userId) {
  for (var i = 0; i < usersOnline.length; i++) {
    if (usersOnline[i] === userId) {
      usersOnline.splice(i, 1);
    }
  }

  updateUserList();
};

var updateGamesList = function() {
  document.getElementById('gamesList').innerHTML = '';
  myGames.forEach(function(game) {
    $('#gamesList').append($('<button>')
      .text('#' + game)
      .on('click', function() {
        socket.emit('resumegame', game);
      }));
  });
};

var updateUserList = function() {
  document.getElementById('userList').innerHTML = '';
  usersOnline.forEach(function(user) {
    $('#userList').append($('<button class="btn">')
      .text(user)
      .on('click', function() {
        socket.emit('invite', user);
      }));
  });
};

//////////////////////////////
// Chess Game
////////////////////////////// 

var initGame = function(serverGameState) {
  serverGame = serverGameState;

  var cfg = {
    draggable: true,
    showNotation: false,
    orientation: playerColor,
    position: serverGame.board ? serverGame.board : 'start',
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd
  };

  game = serverGame.board ? new Chess(serverGame.board) : new Chess();
  board = new ChessBoard('game-board', cfg);
  und = game.undo();
  res = game.reset();
  updateStatus();
}

// do not pick up pieces if the game is over
// only pick up pieces for the side to move
var onDragStart = function(source, piece, position, orientation) {
  if (game.game_over() === true ||
    (game.turn() === 'w' && piece.search(/^b/) !== -1) ||
    (game.turn() === 'b' && piece.search(/^w/) !== -1) ||
    (game.turn() !== playerColor[0])) {
    return false;
  }
};

var onDrop = function(source, target) {
  // see if the move is legal
  var move = game.move({
    from: source,
    to: target,
    promotion: 'q' // NOTE: always promote to a queen for example simplicity
  });

  // illegal move
  if (move === null) {
    return 'snapback';
  } else {
    socket.emit('move', {
      move: move,
      gameId: serverGame.id,
      board: game.fen()
    });
    updateStatus();
  }

};

// update the board position after the piece snap 
// for castling, en passant, pawn promotion
var onSnapEnd = function() {
  board.position(game.fen());
};

var updateStatus = function() {
  var status = '';

  var moveColor = 'White';
  if (game.turn() === 'b') {
    moveColor = 'Black';
  }

  // checkmate?
  if (game.in_checkmate() === true) {
    status = 'Game over, ' + moveColor.toLowerCase() + ' is in checkmate.';
  }

  // draw?
  else if (game.in_draw() === true) {
    status = 'Game over, drawn position';
  }

  // game still on
  else {
    status = moveColor + ' to move';

    // check?
    if (game.in_check() === true) {
      status += ', ' + moveColor.toLowerCase() + ' is in check';
      $('#alert').text('Check on ' + moveColor.toLowerCase() + ' king!').show();
    }
    // no check?
    else {
      $('#alert').fadeOut();
    }
  }

  $('#status').html(status);
};