const socket = io();
let roomId, myId, myPseudo = "";
let angle = 0, targetAngle = 0;
let enemyAngle = 0, enemyTargetAngle = 0;

let myClicks = 0;
let enemyClicks = 0;
let totalClicksToWin = 5 * 36; // car 1 tour = 360°, et 1 clic = 10°, donc 36 clics par tour

let ready = false;

function createRoom() {
  myPseudo = document.getElementById("pseudoInput").value.trim();
  const roomName = document.getElementById("roomNameInput").value.trim();
  const roomPass = document.getElementById("roomPassInput").value;

  if (!myPseudo || !roomName) return alert("Pseudo et nom de room obligatoires !");
  socket.emit("createRoom", { pseudo: myPseudo, roomName, roomPass });
}

function joinRoom() {
  myPseudo = document.getElementById("pseudoInput").value.trim();
  const roomName = document.getElementById("joinRoomNameInput").value.trim();
  const roomPass = document.getElementById("joinRoomPassInput").value;

  if (!myPseudo || !roomName) return alert("Pseudo et nom de room obligatoires !");
  socket.emit("joinRoom", { pseudo: myPseudo, roomName, roomPass });
}


socket.on("roomCreated", (roomName) => {
  alert("Room créée : " + roomName);
  roomId = roomName; // remplacer la variable roomId par roomName
});

socket.on("roomExists", () => alert("Cette room existe déjà !"));
socket.on("roomNotFound", () => alert("Room introuvable !"));
socket.on("wrongPassword", () => alert("Mot de passe incorrect !"));
socket.on("roomFull", () => alert("Room pleine !"));

socket.on("bothPlayersJoined", (players) => {
  document.getElementById("menu").style.display = "none";
  document.getElementById("game").style.display = "block";
  myId = socket.id;
  roomId = players.find(p => p.id === myId)?.roomName || roomId;

  const enemy = players.find(p => p.id !== myId);
  document.getElementById("myName").textContent = myPseudo;
  document.getElementById("enemyName").textContent = enemy ? enemy.pseudo : "???";
  document.getElementById("status").textContent = "Clique sur ✅ Prêt";
});

function setReady() {
  document.getElementById("readyBtn").disabled = true;
  document.getElementById("status").textContent = "En attente de l’adversaire...";
  socket.emit("playerReady", roomId);
}

socket.on("startCountdown", ({ startAt }) => {
  const countdown = document.getElementById("countdown");
  const interval = setInterval(() => {
    const left = Math.ceil((startAt - Date.now()) / 1000);
    if (left > 0) {
      countdown.textContent = left;
    } else if (left === 0) {
      countdown.textContent = "GO!";
      ready = true;
      document.getElementById("clickBtn").style.display = "inline-block";
    } else {
      countdown.textContent = "";
      clearInterval(interval);
    }
  }, 100);
});

function advance() {
  if (!ready) return;
  myClicks++;
  targetAngle += 10;

  updateProgressDisplay();

  if (myClicks >= totalClicksToWin) {
    socket.emit("win", roomId);
  }

  socket.emit("angleUpdate", { roomId, angle: targetAngle, clicks: myClicks });
}

function updateProgressDisplay() {
  const tour = Math.floor(myClicks / 36) + 1;
  const maxTours = 5;
  document.getElementById("tourInfo").textContent = `Tour ${Math.min(tour, 5)}/${maxTours}`;

  const diff = myClicks - enemyClicks;

  let text = `Distance : `;
  if (diff > 0) text += `+${diff} taps (tu es devant)`;
  else if (diff < 0) text += `${diff} taps (tu es derrière)`;
  else text += `±0 taps (même position)`;

  document.getElementById("distanceInfo").textContent = text;
}



socket.on("enemyAngle", ({ angle: a, clicks }) => {
  enemyTargetAngle = a;
  enemyClicks = clicks;
  updateProgressDisplay();
});


socket.on("gameOver", (winnerId) => {
  document.getElementById("clickBtn").style.display = "none";

  // Affichage du message de fin
  const message = winnerId === socket.id
    ? "🎉 Tu as gagné !"
    : "😢 Tu as perdu...";

  document.getElementById("status").textContent = message;

  

  setTimeout(() => {
  document.getElementById("afterGame").style.display = "block";
  document.getElementById("chat").style.display = "block";
}, 5000);
});

socket.on("resetGame", () => {
  angle = 0;
  targetAngle = 0;
  enemyAngle = 0;
  enemyTargetAngle = 0;
  myClicks = 0;
  enemyClicks = 0;
  ready = false;

  updateMyBall();
  updateEnemyBall();
  updateProgressDisplay();

  document.getElementById("status").textContent = "Clique sur ✅ Prêt";
  document.getElementById("clickBtn").style.display = "none";
  document.getElementById("readyBtn").style.display = "inline-block";
  document.getElementById("readyBtn").disabled = false;
  document.getElementById("afterGame").style.display = "none";
  document.getElementById("countdown").textContent = "";
});


function replay() {
  socket.emit("replay", roomId);
}

function quit() {
  socket.emit("leaveRoom", roomId);
  window.location.reload();
}

socket.on("playerLeft", () => {
  alert("L’adversaire a quitté la partie.");
  window.location.reload();
});

function updateMyBall() {
  const rad = angle * Math.PI / 180;
  const x = 150 + 120 * Math.cos(rad);
  const y = 150 + 120 * Math.sin(rad);
  document.getElementById("myBall").style.left = `${x - 10}px`;
  document.getElementById("myBall").style.top = `${y - 10}px`;
}

function updateEnemyBall() {
  const rad = enemyAngle * Math.PI / 180;
  const x = 150 + 120 * Math.cos(rad);
  const y = 150 + 120 * Math.sin(rad);
  document.getElementById("enemyBall").style.left = `${x - 10}px`;
  document.getElementById("enemyBall").style.top = `${y - 10}px`;
}

function sendMessage() {
  const input = document.getElementById("chatInput");
  const msg = input.value.trim();
  if (!msg) return;
  appendMessage(`${myPseudo} : ${msg}`);
  socket.emit("chatMessage", { roomId, pseudo: myPseudo, message: msg });
  input.value = "";
}
socket.on("chatMessage", ({ pseudo, message }) => {
  appendMessage(`${pseudo} : ${message}`);
});

function appendMessage(text) {
  const box = document.getElementById("messages");
  const p = document.createElement("p");
  p.textContent = text;
  box.appendChild(p);
  box.scrollTop = box.scrollHeight;
}


function animate() {
  // Animation joueur
  if (Math.abs(targetAngle - angle) > 0.1) {
    angle += (targetAngle - angle) * 0.1;
    updateMyBall();
  }

  // Animation adversaire
  if (Math.abs(enemyTargetAngle - enemyAngle) > 0.1) {
    enemyAngle += (enemyTargetAngle - enemyAngle) * 0.1;
    updateEnemyBall();
  }

  requestAnimationFrame(animate);
}
animate(); // lancer l'animation continue

updateMyBall();
updateEnemyBall();
