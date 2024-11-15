// UI控制器
class UIController {
    constructor(game, gameHandler) {
        this.game = game;
        this.gameHandler = gameHandler;
        this.selectedCards = [];
        this.initializeUI();
        this.cardImages = {
            'Q': `data:image/svg+xml;base64,${btoa(`
                <svg width="70" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="70" height="100" fill="white" stroke="black"/>
                    <text x="35" y="60" font-size="40" text-anchor="middle" fill="red">Q</text>
                </svg>
            `)}`,
            'K': `data:image/svg+xml;base64,${btoa(`
                <svg width="70" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="70" height="100" fill="white" stroke="black"/>
                    <text x="35" y="60" font-size="40" text-anchor="middle" fill="black">K</text>
                </svg>
            `)}`,
            'A': `data:image/svg+xml;base64,${btoa(`
                <svg width="70" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="70" height="100" fill="white" stroke="black"/>
                    <text x="35" y="60" font-size="40" text-anchor="middle" fill="blue">A</text>
                </svg>
            `)}`,
            'J': `data:image/svg+xml;base64,${btoa(`
                <svg width="70" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="70" height="100" fill="white" stroke="black"/>
                    <text x="35" y="60" font-size="40" text-anchor="middle" fill="purple">J</text>
                </svg>
            `)}`,
            'back': `data:image/svg+xml;base64,${btoa(`
                <svg width="70" height="100" xmlns="http://www.w3.org/2000/svg">
                    <rect width="70" height="100" fill="#2a2a2a" stroke="black"/>
                    <text x="35" y="60" font-size="40" text-anchor="middle" fill="white">?</text>
                </svg>
            `)}`
        };
        this.turnTimer = null;
        this.turnTimeLimit = 15; // 15秒出牌时间
        this.turnTimeLeft = 0;
    }

    initializeUI() {
        // 游戏大厅元素
        this.lobbyScreen = document.getElementById('game-lobby');
        this.gameScreen = document.getElementById('game-table');
        this.playerNameInput = document.getElementById('player-name');
        this.startButton = document.getElementById('start-btn');
        this.playersList = document.getElementById('players');
        
        // 初始状态隐藏游戏界面
        this.gameScreen.style.display = 'none';
        
        // 绑定事件
        this.bindEvents();
        
        // 设置初始状态
        this.setupInitialState();
    }

    setupInitialState() {
        const modeSelect = document.getElementById('game-mode');
        const aiLevel = document.getElementById('ai-level');
        
        modeSelect.addEventListener('change', () => {
            const isSingleMode = modeSelect.value === 'single';
            aiLevel.style.display = isSingleMode ? 'inline-block' : 'none';
            
            if (isSingleMode) {
                this.playersList.innerHTML = `
                    <div>玩家1: 等待开始</div>
                    <div>AI对手: 等待开始</div>
                `;
            } else {
                this.playersList.innerHTML = '';
            }
        });

        // 触发初始状态
        modeSelect.dispatchEvent(new Event('change'));
    }

    // 修改卡牌创建方法
    createCardElement(card, index, isFaceDown = false) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        if (isFaceDown) {
            cardElement.style.backgroundImage = `url(${this.cardImages.back})`;
        } else {
            cardElement.style.backgroundImage = `url(${this.cardImages[card.type]})`;
        }
        cardElement.dataset.index = index;
        return cardElement;
    }

    // 修改更新游戏视图方法
    updateGameView() {
        const gameState = this.game.getGameState();
        if (!gameState) return;
        
        // 显示游戏界面
        this.gameScreen.style.display = 'block';
        this.lobbyScreen.style.display = 'none';
        
        // 更新游戏信息
        document.getElementById('target-card').textContent = gameState.targetCard || '未指定';
        document.getElementById('current-player').textContent = gameState.players[gameState.currentPlayer]?.name || '未知';
        
        // 更新玩家信息和手牌
        gameState.players.forEach((player, index) => {
            const playerArea = document.getElementById(`player${index + 1}`);
            if (!playerArea) return;

            const nameElement = playerArea.querySelector('.player-name');
            const bulletElement = playerArea.querySelector('.bullet-count');
            const handElement = playerArea.querySelector('.hand');

            nameElement.textContent = `${player.name} ${player.alive ? '' : '(已出局)'}`;
            bulletElement.textContent = `剩余: ${player.bulletCount}发`;
            
            handElement.innerHTML = '';
            
            if (index === 0) {
                // 玩家手牌
                this.game.players[0].cards.forEach((card, cardIndex) => {
                    const cardElement = this.createCardElement(card, cardIndex);
                    cardElement.addEventListener('click', () => this.handleCardSelect(cardIndex));
                    handElement.appendChild(cardElement);
                });
            } else {
                // AI手牌（背面）
                for(let i = 0; i < player.cardCount; i++) {
                    const cardElement = this.createCardElement(null, i, true);
                    handElement.appendChild(cardElement);
                }
            }
        });

        // 更新按钮状态
        this.updateGameControls();

        // 显示已打出的牌（如果有）
        const playedCardsArea = document.getElementById('played-cards');
        if (playedCardsArea && this.game.playedCards && this.game.playedCards.length > 0) {
            this.updatePlayedCards(
                this.game.playedCards,
                this.game.lastPlayedInfo.claimedType,
                this.game.lastPlayedInfo.claimedCount
            );
        }

        // 如果当前是AI的回合且没有上一次出牌记录，触发AI行动
        if (gameState.currentPlayer === 1 && !this.game.lastPlayedInfo) {
            this.handleAITurn();
        }

        // 更新计时器显示
        const timerElement = document.getElementById('turn-timer');
        if (timerElement) {
            timerElement.textContent = this.turnTimeLeft;
        }
    }

    bindEvents() {
        // 只绑定开始游戏按钮和游戏操作事件
        this.startButton.addEventListener('click', () => this.handleStartGame());
        
        // 绑定游戏操作事件
        document.getElementById('play-btn').addEventListener('click', () => this.handlePlay());
        document.getElementById('challenge-btn').addEventListener('click', () => this.handleChallenge());
    }

    handleStartGame() {
        const gameMode = document.getElementById('game-mode').value;
        const playerName = this.playerNameInput.value.trim() || '玩家1';

        if (gameMode === 'single') {
            // 重置游戏状态
            this.game.players = [];
            // 创建玩家和AI
            this.gameHandler.handlePlayerJoin(playerName);
            this.gameHandler.handlePlayerJoin('AI对手');
            
            // 初始化新一游戏
            if (this.gameHandler.handleGameStart()) {
                // 隐藏大厅，显示游戏界面
                this.lobbyScreen.style.display = 'none';
                this.gameScreen.style.display = 'block';
                
                // 更新游戏视图
                this.updateGameView();
                // 如果是玩家回合，开始计时
                if (this.game.currentPlayer === 0) {
                    this.startTurnTimer();
                }
            }
        }
    }

    updatePlayerHand(player) {
        if (!player || !player.cards) return;
        
        const handElement = document.querySelector('#player1 .hand');
        if (!handElement) return;

        handElement.innerHTML = '';
        player.cards.forEach((card, index) => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            cardElement.textContent = card.type;
            cardElement.dataset.index = index;
            cardElement.addEventListener('click', () => this.handleCardSelect(index));
            handElement.appendChild(cardElement);
        });
    }

    handleCardSelect(index) {
        const cardElement = document.querySelector(`[data-index="${index}"]`);
        if (this.selectedCards.includes(index)) {
            this.selectedCards = this.selectedCards.filter(i => i !== index);
            cardElement.classList.remove('selected');
        } else if (this.selectedCards.length < 3) {
            this.selectedCards.push(index);
            cardElement.classList.add('selected');
        }
        
        // 更新出牌按钮状态
        const playButton = document.getElementById('play-btn');
        playButton.disabled = this.selectedCards.length === 0 || this.game.currentPlayer !== 0;
    }

    handleAITurn() {
        // 确保是AI的回合
        if (this.game.currentPlayer !== 1) return;
        
        // 清除之前的计时器
        this.clearTurnTimer();
        
        setTimeout(() => {
            const ai = this.game.players[1];
            const targetCard = this.game.targetCard;
            
            // 统计手牌中目标牌的数量
            const targetCardCount = ai.cards.filter(card => 
                card.type === targetCard || card.type === 'J'
            ).length;
            
            // 决定是否说谎
            const shouldLie = Math.random() < 0.5;
            let cardCount;
            let cardIndices;
            
            if (shouldLie) {
                // 说谎策略：出非目标牌
                const nonTargetCards = ai.cards
                    .map((card, index) => ({card, index}))
                    .filter(({card}) => card.type !== targetCard && card.type !== 'J');
                    
                if (nonTargetCards.length > 0) {
                    cardCount = Math.min(3, nonTargetCards.length);
                    cardIndices = nonTargetCards
                        .slice(0, cardCount)
                        .map(({index}) => index);
                } else {
                    // 如果没有非目标牌，就只能出真牌
                    cardCount = Math.min(3, targetCardCount);
                    cardIndices = ai.cards
                        .map((card, index) => ({card, index}))
                        .filter(({card}) => card.type === targetCard || card.type === 'J')
                        .slice(0, cardCount)
                        .map(({index}) => index);
                }
            } else {
                // 出真牌策略
                cardCount = Math.min(3, targetCardCount);
                cardIndices = ai.cards
                    .map((card, index) => ({card, index}))
                    .filter(({card}) => card.type === targetCard || card.type === 'J')
                    .slice(0, cardCount)
                    .map(({index}) => index);
            }
            
            // AI出牌
            if (this.gameHandler.handlePlayCards(1, cardIndices, targetCard, cardCount)) {
                console.log('AI played:', cardCount, 'cards, lying:', shouldLie);
                // 更新出牌显示
                this.updatePlayedCards(
                    this.game.playedCards,
                    targetCard,
                    cardCount
                );
                this.updateGameView();
                
                // 确保质疑按钮可用
                const challengeButton = document.getElementById('challenge-btn');
                if (challengeButton) {
                    challengeButton.disabled = false;
                }
                
                // 启动玩家的计时器
                if (this.game.currentPlayer === 0) {
                    this.startTurnTimer();
                }
            }
        }, 1000);
    }

    // 添加新方法来更新游戏控制按钮状态
    updateGameControls() {
        const gameState = this.game.getGameState();
        const playButton = document.getElementById('play-btn');
        const challengeButton = document.getElementById('challenge-btn');
        
        // 如果是当前玩家的回合
        if (gameState.currentPlayer === 0) {
            // 只有选择了牌才能出牌
            playButton.disabled = this.selectedCards.length === 0;
            // 玩家回合不能质疑
            challengeButton.disabled = true;
        } else {
            // 如果是AI的回合
            playButton.disabled = true;
            // 只有AI刚刚出过牌才能质疑
            challengeButton.disabled = !this.game.lastPlayedInfo || 
                                     this.game.lastPlayedInfo.playerId !== 1 ||
                                     !this.game.players[0].alive;
        }

        // 如果是玩家出牌后，AI考虑是否质疑
        if (gameState.currentPlayer === 1 && 
            this.game.lastPlayedInfo && 
            this.game.lastPlayedInfo.playerId === 0 &&
            this.game.players[1].alive) {
            setTimeout(() => {
                this.handleAIChallenge();
            }, 1000);
        }
    }

    // 新增 handlePlay 方法（替代原来的 showPlayDialog）
    handlePlay() {
        if (this.selectedCards.length === 0) {
            alert('请选择要出的牌');
            return;
        }

        // 直接使用目标牌作为声明的牌型
        const claimedType = this.game.targetCard;
        const claimedCount = this.selectedCards.length;

        if (this.gameHandler.handlePlayCards(0, this.selectedCards, claimedType, claimedCount)) {
            this.clearTurnTimer(); // 清除时器
            this.selectedCards = [];
            // 更新出牌显示
            this.updatePlayedCards(
                this.game.playedCards,
                claimedType,
                claimedCount
            );
            this.updateGameView();
            
            // 玩家出牌后，延迟一段时间再让AI行动
            setTimeout(() => {
                if (this.game.currentPlayer === 1) {
                    this.handleAITurn();
                }
            }, 1000);
        } else {
            alert('出牌失败，请检查出牌是否合法');
        }
    }

    // 修改 handleChallenge 方法
    handleChallenge() {
        if (!this.game.lastPlayedInfo) {
            console.error('No cards to challenge');
            return;
        }
        
        // 显示质疑提示
        this.showChallengeNotification(() => {
            // 显示被质疑的牌
            this.showChallengedCards(() => {
                // 显示牌后确定惩罚对象
                const result = this.gameHandler.handleChallenge(0);
                this.showPunishmentNotification(result, () => {
                    // 最后显示轮盘赌动画
                    this.showRouletteAnimation(result);
                });
            });
        });
    }

    // 添加质疑提示方法
    showChallengeNotification(callback, isAI = false) {
        const notification = document.createElement('div');
        notification.className = 'game-notification challenge';
        notification.textContent = isAI ? 'AI对手质疑！' : '质疑！';
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            callback();
        }, 1500);
    }

    // 修改显示被质疑牌的方法
    showChallengedCards(callback, isAI = false) {
        const playedCardsArea = document.getElementById('played-cards');
        const {cards, claimedType, claimedCount} = this.game.lastPlayedInfo;
        
        // 计算实际牌数
        let realCount = 0;
        cards.forEach(card => {
            if (card.type === claimedType || card.type === 'J') {
                realCount++;
            }
        });
        
        // 更新信息显示
        const playedInfo = playedCardsArea.querySelector('.played-info');
        if (playedInfo) {
            playedInfo.textContent = `声称: ${claimedCount}张${claimedType}`;
        }
        
        // 翻转所有牌
        const cardElements = playedCardsArea.querySelectorAll('.card');
        cardElements.forEach((cardElement, index) => {
            setTimeout(() => {
                cardElement.classList.add('flipped');
                // 确保正面的牌显示正确的图片
                const cardFront = cardElement.querySelector('.card-front');
                if (cardFront) {
                    const frontImg = cardFront.querySelector('div');
                    if (frontImg) {
                        frontImg.style.backgroundImage = `url(${this.cardImages[cards[index].type]})`;
                    }
                }
            }, index * 300);
        });
        
        // 显示实际情况
        setTimeout(() => {
            if (playedInfo) {
                playedInfo.textContent += ` | 实际: ${realCount}张${claimedType}`;
            }
            setTimeout(callback, 1000);
        }, cards.length * 300 + 500);
    }

    // 修改惩罚提示方法
    showPunishmentNotification(result, callback) {
        const notification = document.createElement('div');
        notification.className = 'game-notification punishment';
        
        // 获取被惩罚的玩家
        const lastPlayInfo = this.game.lastPlayedInfo;
        const challengerId = 0;  // 玩家的ID是0
        
        let punishedPlayer;
        if (lastPlayInfo.playerId === 1) {
            // 如果是AI的出牌被质疑
            if (result) {
                // 质疑成功，AI说谎，AI接受惩罚
                punishedPlayer = 'AI对手';
            } else {
                // 质疑失败，AI说实话，玩家接受惩罚
                punishedPlayer = this.game.players[challengerId].name;
            }
        } else {
            // 如果是玩家的出牌被AI质疑
            if (result) {
                // 质疑成功，玩家说谎，玩家接受惩罚
                punishedPlayer = this.game.players[lastPlayInfo.playerId].name;
            } else {
                // 质疑失败，玩家说实话，AI接受惩罚
                punishedPlayer = 'AI对手';
            }
        }
        
        notification.textContent = `${punishedPlayer} 将接受惩罚！`;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
            callback();
        }, 1500);
    }

    // 修改轮盘赌动画方法
    showRouletteAnimation(result) {
        const animation = document.getElementById('roulette-animation');
        const cylinder = animation.querySelector('.cylinder');
        const resultDiv = animation.querySelector('.result');
        
        // 显示动画
        animation.classList.remove('hidden');
        
        // 设置旋转动画
        const currentShot = 6 - this.game.players[this.game.currentPlayer].bulletCount;
        cylinder.style.setProperty('--rotation-degrees', `${currentShot * 60}deg`);
        cylinder.style.animation = 'spin-to-position 2s ease-out forwards';
        
        // 等待动画结束后显示结果
        setTimeout(() => {
            resultDiv.textContent = result ? '砰！' : '咔！';
            resultDiv.style.color = result ? 'red' : 'green';
            resultDiv.style.opacity = '1';
            
            // 添加结果动画
            const resultAnimation = document.createElement('div');
            resultAnimation.className = `result-animation ${result ? 'dead' : 'alive'}`;
            animation.appendChild(resultAnimation);
            
            setTimeout(() => {
                animation.classList.add('hidden');
                resultAnimation.remove();
                
                // 检查游戏是否结束
                const winner = this.game.checkGameEnd();
                if (winner) {
                    this.showGameOver(winner);
                } else {
                    this.startNewRound();
                }
            }, 2000);
        }, 2000);
    }

    // 添加游戏结束显示方法
    showGameOver(winner) {
        const gameOver = document.createElement('div');
        gameOver.className = 'game-over';
        gameOver.innerHTML = `
            <h2>游戏结束</h2>
            <p>${winner.name} 获胜！</p>
            <button onclick="location.reload()">返回大厅</button>
        `;
        document.body.appendChild(gameOver);
    }

    // 添加开始新一轮的方法
    startNewRound() {
        // 保存当前玩家的子弹数和存活状态
        const bulletCounts = this.game.players.map(p => p.bulletCount);
        const aliveStatus = this.game.players.map(p => p.alive);
        
        // 重新初始化牌组和发牌
        this.game.initializeDeck();
        this.game.shuffleDeck();
        this.game.dealCards();
        
        // 随机选择新的目标牌
        const types = ['Q', 'K', 'A'];
        this.game.targetCard = types[Math.floor(Math.random() * types.length)];
        
        // 恢复玩家的子弹数和存活状态
        this.game.players.forEach((player, index) => {
            player.bulletCount = bulletCounts[index];
            player.alive = aliveStatus[index];
        });
        
        // 更新游戏状态
        this.game.gameState = 'playing';
        this.game.currentPlayer = Math.floor(Math.random() * this.game.players.length);
        this.game.lastPlayedInfo = null;
        this.game.playedCards = [];
        
        // 清空选中的牌
        this.selectedCards = [];
        
        // 更新界面
        this.updateGameView();
        
        // 如果是玩家回合，开始新的计时
        if (this.game.currentPlayer === 0) {
            this.startTurnTimer();
        }
    }

    // 添加计时器控制方法
    startTurnTimer() {
        this.clearTurnTimer();
        this.turnTimeLeft = this.turnTimeLimit;
        
        const timerElement = document.getElementById('turn-timer');
        if (timerElement) {
            timerElement.textContent = this.turnTimeLeft;
        }
        
        this.turnTimer = setInterval(() => {
            this.turnTimeLeft--;
            if (timerElement) {
                timerElement.textContent = Math.max(0, this.turnTimeLeft);
            }
            
            if (this.turnTimeLeft <= 0) {
                this.clearTurnTimer();
                if (this.game.currentPlayer === 0) {
                    this.handleRandomPlay();
                }
            }
        }, 1000);
    }

    clearTurnTimer() {
        if (this.turnTimer) {
            clearInterval(this.turnTimer);
            this.turnTimer = null;
        }
    }

    // 添加随机出牌方法
    handleRandomPlay() {
        const player = this.game.players[0];
        const cardCount = Math.floor(Math.random() * Math.min(3, player.cards.length)) + 1;
        const cardIndices = Array.from({length: cardCount}, (_, i) => i);
        
        if (this.gameHandler.handlePlayCards(0, cardIndices, this.game.targetCard, cardCount)) {
            this.selectedCards = [];
            this.updateGameView();
            
            setTimeout(() => {
                if (this.game.currentPlayer === 1) {
                    this.handleAITurn();
                }
            }, 1000);
        }
    }

    // 添加 AI 质疑决策方法
    handleAIChallenge() {
        const lastPlay = this.game.lastPlayedInfo;
        if (!lastPlay) return;
        
        // AI质疑策略计算...
        let challengeProbability = 0.3;
        challengeProbability += lastPlay.claimedCount * 0.2;
        challengeProbability += targetCardCount * 0.1;
        
        if (Math.random() < challengeProbability) {
            console.log('AI challenges!');
            // 显示AI质疑动画
            this.showChallengeNotification(() => {
                // 显示被质疑的牌
                this.showChallengedCards(() => {
                    const result = this.gameHandler.handleChallenge(1);
                    this.showPunishmentNotification(result, () => {
                        this.showRouletteAnimation(result);
                    });
                }, true); // 传入true表示是AI在质疑
            }, true); // 传入true表示是AI在质疑
        } else {
            // AI不质疑，继续游戏
            this.handleAITurn();
        }
    }

    // 修改显示出牌方法
    updatePlayedCards(cards, claimedType, claimedCount) {
        const playedCardsArea = document.getElementById('played-cards');
        playedCardsArea.innerHTML = '';
        
        // 显示出牌信息
        const playedInfo = document.createElement('div');
        playedInfo.className = 'played-info';
        playedInfo.textContent = `声称: ${claimedCount}张${claimedType}`;
        playedCardsArea.appendChild(playedInfo);
        
        // 创建卡牌容器
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'played-cards-container';
        
        // 添加卡牌
        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card';
            
            // 创建卡牌正面
            const cardFront = document.createElement('div');
            cardFront.className = 'card-face card-front';
            const frontImg = document.createElement('div');
            frontImg.style.width = '100%';
            frontImg.style.height = '100%';
            frontImg.style.backgroundImage = `url(${this.cardImages[card.type]})`;
            frontImg.style.backgroundSize = 'cover';
            frontImg.style.backgroundPosition = 'center';
            cardFront.appendChild(frontImg);
            
            // 创建卡牌背面
            const cardBack = document.createElement('div');
            cardBack.className = 'card-face card-back';
            cardBack.textContent = '?';
            
            cardElement.appendChild(cardFront);
            cardElement.appendChild(cardBack);
            cardsContainer.appendChild(cardElement);
        });
        
        playedCardsArea.appendChild(cardsContainer);
    }
}

// 初始化UI
const uiController = new UIController(game, gameHandler); 