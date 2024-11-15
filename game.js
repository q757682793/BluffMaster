// 卡牌类
class Card {
    constructor(type, value) {
        this.type = type;  // Q, K, A, J(Joker)
        this.value = value; // 普通牌为1，大小王为2
        this.faceDown = true;
    }
}

// 玩家类
class Player {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.cards = [];
        this.alive = true;
        this.bulletCount = 6; // 轮盘赌剩余次数
    }

    // 选择要出的牌
    selectCards(indices) {
        if (indices.length > 3 || indices.length < 1) return null;
        return indices.map(i => this.cards[i]);
    }

    // 移除出过的牌
    removeCards(cards) {
        cards.forEach(card => {
            const index = this.cards.indexOf(card);
            if (index > -1) {
                this.cards.splice(index, 1);
            }
        });
    }
}

// 游戏主类
class Game {
    constructor() {
        this.players = [];
        this.deck = [];
        this.currentPlayer = 0;
        this.targetCard = null; // 本轮目标牌型
        this.playedCards = []; // 当前回合打出的牌
        this.currentRound = 1;
        this.gameState = 'waiting'; // waiting, playing, finished
        this.lastPlayedInfo = null; // 记录上一次出牌信息
    }

    // 添加玩家
    addPlayer(name) {
        if (this.players.length >= 4) return false;
        const player = new Player(this.players.length, name);
        this.players.push(player);
        return true;
    }

    // 初始化牌组
    initializeDeck() {
        this.deck = [];
        ['Q', 'K', 'A'].forEach(type => {
            for(let i = 0; i < 6; i++) {
                this.deck.push(new Card(type, 1));
            }
        });
        // 添加大小王
        this.deck.push(new Card('J', 2));
        this.deck.push(new Card('J', 2));
    }

    // 洗牌
    shuffleDeck() {
        for(let i = this.deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.deck[i], this.deck[j]] = [this.deck[j], this.deck[i]];
        }
    }

    // 开始新一轮游戏
    startNewRound() {
        // 初始化牌组
        this.initializeDeck();
        this.shuffleDeck();
        
        // 重置游戏状态
        this.playedCards = [];
        this.lastPlayedInfo = null;
        
        // 随机选择目标牌型
        const types = ['Q', 'K', 'A'];
        this.targetCard = types[Math.floor(Math.random() * types.length)];
        
        // 发牌
        this.dealCards();
        
        // 设置游戏状态和初始玩家
        this.gameState = 'playing';
        this.currentPlayer = Math.floor(Math.random() * this.players.length);
        
        // 调试信息
        console.log('Initial deck:', this.deck);
        console.log('Player cards:', this.players.map(p => ({
            name: p.name,
            cards: p.cards
        })));
    }

    // 发牌
    dealCards() {
        this.players.forEach(player => {
            if (player.alive) {
                player.cards = []; // 清空现有手牌
                for(let i = 0; i < 5; i++) {
                    if(this.deck.length > 0) {
                        const card = this.deck.pop();
                        player.cards.push(card);
                    }
                }
            }
        });
    }

    // 出牌
    playCards(playerId, cards, claimedType, claimedCount) {
        const player = this.players[playerId];
        
        // 验证是否是当前玩家的回合
        if (playerId !== this.currentPlayer || !player.alive) return false;
        
        // 验证出牌数量
        if (cards.length > 3 || cards.length < 1 || cards.length !== claimedCount) return false;
        
        // 记录出牌信息
        this.lastPlayedInfo = {
            playerId,
            cards,
            claimedType,
            claimedCount
        };
        
        // 移除玩家手牌
        player.removeCards(cards);
        this.playedCards = cards;
        
        // 移动到下一个存活玩家
        this.moveToNextPlayer();
        
        return true;
    }

    // 移动到下一个玩家
    moveToNextPlayer() {
        do {
            this.currentPlayer = (this.currentPlayer + 1) % this.players.length;
        } while (!this.players[this.currentPlayer].alive);
    }

    // 检查出牌真实性
    checkCards(challengerId) {
        if (!this.lastPlayedInfo) return false;
        
        const {cards, claimedType, claimedCount} = this.lastPlayedInfo;
        let realCount = 0;
        
        // 计算实际符合声明的牌数
        cards.forEach(card => {
            if (card.type === claimedType || card.type === 'J') {
                realCount++;
            }
        });
        
        // 判定真假
        const isLying = realCount < claimedCount;
        
        // 执行轮盘赌
        if (isLying) {
            // 出牌者说谎，由出牌者轮盘赌
            return this.russianRoulette(this.lastPlayedInfo.playerId);
        } else {
            // 出牌者诚实，由质疑者轮盘赌
            return this.russianRoulette(challengerId);
        }
    }

    // 俄罗斯轮盘赌
    russianRoulette(playerId) {
        const player = this.players[playerId];
        if (player.bulletCount <= 0) return false;
        
        const shot = Math.random() < 1/6;
        if (shot) {
            player.alive = false;
            // 检查游戏是否结束
            this.checkGameEnd();
            return true;
        }
        player.bulletCount--;
        return false;
    }

    // 检查游戏是否结束
    checkGameEnd() {
        const alivePlayers = this.players.filter(p => p.alive);
        if (alivePlayers.length === 1) {
            this.gameState = 'finished';
            return alivePlayers[0];
        }
        return null;
    }

    // 获取游戏状态
    getGameState() {
        return {
            players: this.players.map(p => ({
                id: p.id,
                name: p.name,
                cardCount: p.cards.length,
                alive: p.alive,
                bulletCount: p.bulletCount
            })),
            currentPlayer: this.currentPlayer,
            targetCard: this.targetCard,
            gameState: this.gameState,
            currentRound: this.currentRound
        };
    }
}

// 游戏事件处理器
class GameEventHandler {
    constructor(game) {
        this.game = game;
    }

    // 处理玩家加入
    handlePlayerJoin(name) {
        return this.game.addPlayer(name);
    }

    // 处理游戏开始
    handleGameStart() {
        if (this.game.players.length < 2) return false;
        this.game.startNewRound();
        return true;
    }

    // 处理出牌
    handlePlayCards(playerId, cardIndices, claimedType, claimedCount) {
        const player = this.game.players[playerId];
        const cards = player.selectCards(cardIndices);
        if (!cards) return false;
        
        return this.game.playCards(playerId, cards, claimedType, claimedCount);
    }

    // 处理质疑
    handleChallenge(challengerId) {
        return this.game.checkCards(challengerId);
    }
}

// 初始化游戏
const game = new Game();
const gameHandler = new GameEventHandler(game);