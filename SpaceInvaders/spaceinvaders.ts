import { fromEvent,interval,merge,Observable } from 'rxjs'; 
import { map,filter,mergeMap,takeUntil,scan,sampleTime} from 'rxjs/operators';

//[1]Reference the asteroid game from course notes heavily: https://tgdwyer.github.io/asteroids/  
//[2]Reference for dealing with negative mod numbers: https://stackoverflow.com/questions/4467539/javascript-modulo-gives-a-negative-result-for-negative-numbers
//[3]Reference for regex to remove non numeric chars: https://stackoverflow.com/a/6649344
//[4]Reference for mapping to create new object for each elem in array: https://stackoverflow.com/questions/40348171/es6-map-an-array-of-objects-to-return-an-array-of-objects-with-new-keys
//[5]Reference for removing a HTML child: https://stackoverflow.com/a/3391282
//[6]Reference for laser collision: https://github.com/fdb/space-game/tree/master/step07
//[7]Reference for changing HTML text: https://www.w3schools.com/js/js_htmldom_html.asp
//[8]Reference for overlaying HTML elements: https://stackoverflow.com/a/10721286 (changed in the CSS code)
//[9]Reference for regex all numbers including negative. https://stackoverflow.com/a/35800136
//[10]Reference for game over(win/lose) display: https://github.com/fdb/space-game/tree/master/step10/css/main.css


type Event = 'win' | 'lose'
function spaceinvaders(currentLevel: number, alienShootProb : number, alienLaserSpeed: number, alienXDelta: number, playerLaserCooldown: number, playerLaserSpeed: number) {
    // Inside this function you will use the classes and functions 
    // from rx.js
    // to add visuals to the svg element in pong.html, animate them, and make them interactive.
    // Study and complete the tasks in observable exampels first to get ideas.
    // Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/ 
    // You will be marked on your functional programming style
    // as well as the functionality that you implement.
    // Document your code! 
      //get the canvas width from the html file

  
    //----------------------------------------------Initial setup stuff-------------------------------------------//

  const  //Constants to be used in the game
  Constants = {
    ALIEN_X_DELTA: alienXDelta,    //Movement of the alien according to X changes(delta)
    ALIEN_Y_DELTA: 20,     //Movement of the alien according to Y changes(delta).
    START_TIME: 0,
    NUMBER_OF_ALIENS: 24,  //Number of aliens in the canvas
    GAME_SPEED: 10,    //game speed which affects alien speed
    CANVAS_WIDTH: Number(document.getElementById("canvas").getAttribute('width')), //Width and height of canvas
    CANVAS_HEIGHT: Number(document.getElementById("canvas").getAttribute('height')),
    
    //for player laser. Offset is neccessary to get to the top middle of the ship (where lasers come out of)
    SHIP_OFFSET_X: 25, //the x offset to reach the middle of the ship. Translate is only the left corner of the ship
    SHIP_OFFSET_Y: 60,
    PLAYER_LASER_SPEED: playerLaserSpeed,   //laser speed in terms of Y coordinates movement per game clock tick
    PLAYER_LASER_COOLDOWN: playerLaserCooldown, //the player's laser have a cooldown
    
    //for alien laser
    ALIEN_SHOOT_PROB: alienShootProb,  //Probability of an alien to shoot a laser
    ALIEN_LASER_SPEED: alienLaserSpeed,    //laser speed in terms of Y coordinates movement per game clock tick
    ALIEN_RANDOM_SEED: 30,

    //for scoring
    CURRENT_LEVEL: currentLevel,
    ALIEN_KILL_SCORE: 1
  } as const

  type ShipState = Readonly<{    //Keep track of the ship's state
    readonly id: string;
    readonly x: number;
    readonly y:number;
    readonly dead: boolean;
    readonly fire: boolean;
  }>

  type AlienState = Readonly<{    //Keep track of the alien's state
    readonly id: string;
    readonly x: number;
    readonly y:number;
    readonly dead: boolean;    //boolean whether this alien is shot and died
    readonly fire: boolean;
    
  }>

  type LaserState = Readonly<{    //Keep track of the laser's state (individual)
    readonly id: string;
    readonly owner: string;    //The owner of the laser (ship or alien)
    readonly x: number;
    readonly y:number;
    readonly dead: boolean;
  }>


  // Game state to keep track of all the other smaller states
  type GameState = Readonly<{
    time:Observable<Tick>,
    score: number,
    ship: ShipState,
    aliens: AlienState[],
    laserStates: LaserState[],
  }>


  const ship = document.getElementById("ship");
  //Ref[3] to remove non numeric numbers
  const initialXShip = Number(ship.getAttribute("transform").split(" ")[0].replace(/(?!-)[^0-9.]/g, ''));
  const initialYShip = Number(ship.getAttribute("transform").split(" ")[1].replace(/(?!-)[^0-9.]/g, ''));
  
  //init the initial ship states 
  const initialShipState: ShipState = {id: "ship", x:initialXShip,y:initialYShip,dead:false, fire: false};


  //function which is used to create aliens on the canvas and to create the initial alien states
  function createAlienCircles(numberOfAliens: number): AlienState[]{
    
    let alienState = []; //will return a list of alien states
    const topRowY = 50; //top row y coordinates
    const leftColX = 100; //left column x coordinates
    const canvas = document.getElementById("canvas"); //canvas element
    canvas.querySelectorAll('.aliendot').forEach(e => e.remove());
    const numOfRows = 3
    const numOfColumns = numberOfAliens/3
    let countOfAliens = 0

    for (let i = 0;i < numOfRows; i++){  //for rows
      for (let j = 0; j<numOfColumns;j++ ){ //for cols
        const newAlien = document.createElementNS(canvas.namespaceURI,"circle"); //create a new line for the laser
        newAlien.classList.add("aliendot") //Add bullet class and create the coordinates
        newAlien.setAttribute("cx",String(leftColX + j * 50))   //set circle attributes
        newAlien.setAttribute("cy",String(topRowY + i * 50)) 
        newAlien.setAttribute("r","20") 
        newAlien.setAttribute("display","inline")   
        newAlien.setAttribute("id", `alien${countOfAliens}`)  //Give each laser a unique laser id
        canvas.appendChild(newAlien)
        
        const newAlienState: AlienState =  //alien state that will be used in game to track position of alien
        {
          id: `alien${countOfAliens}`,
          x: leftColX + j * 50, 
          y: topRowY + i * 50,
          dead: false, //not dead in beginning
          fire: false
        }
        alienState.push(newAlienState);  //add this new alien to the array  
        countOfAliens ++;
      }
    }
    return alienState;
  }

  //Create the aliens on the canvas
  const initialAliensStates = createAlienCircles(Constants.NUMBER_OF_ALIENS);
 
  class Tick { constructor(public readonly elapsed:number) {} }

  
  //From ref[1]
  const gameClock = interval(Constants.GAME_SPEED).pipe(map(elapsed=>new Tick(elapsed)))

  //the initial game states containing all the other init states
  const initialGameState: GameState = {time:gameClock,ship:initialShipState,aliens:initialAliensStates, score:0, laserStates: []};


  //-----------------------------------------Scoring stuff------------------------------------------------//
  
  //Pure function to update the current score based on dead aliens in game
  function playerScoreTransitions(state: GameState): GameState{
    return {...state,
       //The score is the number of dead aliens in the game currently
      score: state.aliens.filter(alien => alien.dead === true).length
    }
  }

  //Ref[7] changing the HTML text elem. 
  //impure function which updates the player score and changes the html element. 
  function updateViewScore(state: GameState):void{
    document.getElementById("gameScore").innerHTML = String(state.score);
  }

  //Impure function which updates the current html text element
  function updateLevel():void{
    document.getElementById("level").innerHTML = String(Constants.CURRENT_LEVEL + 1);
  }
    

  //----------------------------------------------Laser stuff----------------------------------------------//
        

  //Impure function. Remove an element from the parent (usually from the canvas) given the ID. 
  //Ref [5]
  function removeElemFromCanvas(id: string):void{
    const object = document.getElementById(id);
    object.parentNode.removeChild(object);
  }


  //Create new active lasers for any firing entity. Pure since no side effects
  function fireLasers(state: GameState):GameState{

    //add to active laser states if the alien/player is shooting
    //Will get a new state for a new ship active laser if its firing. If its not, just the same state
    const shipLasers = state.ship.fire === true? createLasers(state,state.ship.id,state.laserStates.length) : state  //create a laser for the ship
    
    let alienLasers = []
    //For each alien if its shooting, create a laser for it
    state.aliens.filter(aliens => aliens.fire === true).forEach(
      x => alienLasers = alienLasers.concat(createLasers(state,x.id,state.laserStates.length+alienLasers.length)));

    return {... state,
      laserStates: (shipLasers as GameState).laserStates.concat(alienLasers)
    }
  }

  //Impure function. Update the view of the lasers.
  function updateViewLasers(state: GameState): void{
    
    //if the laser goes out of the map, remove the laser from canvas
    state.laserStates.forEach(laserState=>{
      const laser = document.getElementById(laserState.id);

      if (laserState.dead){ //if laser is dead
        laser.setAttribute("display","none"); //Dont display a dead laser
      }

      else{ //if laser is not dead, set it to new state + some additional offset to appear below the alien
        laser.setAttribute('y1',String(laserState.y+ 10));    
        laser.setAttribute('y2',String(laserState.y+ 30));    //30 is for the length of the laser
      }
    })
  }

  //Pure function which move the active lasers upwards/downwards
  function laserTransitions(state:GameState,delta: number): GameState{
    
    return {...state,
      laserStates: state.laserStates.map(laserState=>    
         ({...laserState,
          dead: (laserState.y <= 0 || laserState.y >= Constants.CANVAS_HEIGHT)? true:false, //Update laser if out of bounds
          y: 
            delta === 0? //ignore player inputs (if xDelta is -1,1 or 2 ignore and dont change state)
              laserState.owner === "ship"? laserState.y - Constants.PLAYER_LASER_SPEED :    //move the y coordinates based on laser speed. This is for ship's laser (laser moves upwards)
              laserState.y + Constants.ALIEN_LASER_SPEED  :   //This is for alien (laser moves downwards)
            laserState.y 
         })
      )
    } 
  }

  //Pure function which returns a new game state or laser state. 
  //numofLasers is the total active lasers in the game. This is important to give each laser a unique ID which will
  //be used to identify the laser in other functions involving lasers
  function createLasers(state: GameState, elemID: string, numOfLasers: number) : GameState|LaserState{  // Return a new game state with the new active laser 

    //Get the html elements
    const canvas = document.getElementById("canvas");
    const laser = document.createElementNS(canvas.namespaceURI,"line"); //create a new line for the laser
    laser.classList.add("bullet") //Add bullet class and create the coordinates
    
    if (elemID === "ship"){ //creating the laser for the ship

      const elemX = state.ship.x; //Ship's x coordinates
      const elemY = state.ship.y; //Ship's y coordinates
    
      laser.setAttribute("id",`laser${numOfLasers}`)  //Give each laser a unique laser id
      laser.setAttribute("x1", String(elemX + Constants.SHIP_OFFSET_X))    //plus offset to create laser at the mid of ship
      laser.setAttribute("x2", String(elemX + Constants.SHIP_OFFSET_X))
      laser.setAttribute("y1", String(elemY + Constants.SHIP_OFFSET_Y)) //start at the top of ship
      laser.setAttribute("y2", String(elemY +30))    //end point of laser
      canvas.appendChild(laser);

      const newLaser : LaserState = {   //keep track of this current laser state
        id: `laser${numOfLasers}`, //give the laser a unique id
        owner: elemID,
        x: Number(elemX) + Constants.SHIP_OFFSET_X,
        y: Number(elemY) + Constants.SHIP_OFFSET_Y,
        dead: false
      } 

      //Return a new Game State with an additional laser state
      return { ...state,
        laserStates: state.laserStates.concat(newLaser)
      }
    }
    else{ //creating the laser for the alien
    
      //Get the alien that is firing the laser from the game state
      const elem = state.aliens.find(alien => alien.id === elemID);
      
      const alienX = elem.x; //x coordinates of the aliens
      const alienY = elem.y; //y coordinates of the aliens
      
      laser.setAttribute("id",`laser${numOfLasers}`);
      laser.setAttribute("x1", String(alienX));    
      laser.setAttribute("x2", String(alienX));
      laser.setAttribute("y1", String(alienY + 30)); //set the laser to be slightly below the alien
      laser.setAttribute("y2", String(alienY + 60)); //length of laser is 30   

      canvas.appendChild(laser);
      const newLaser : LaserState = {   //keep track of this current laser state
        id: `laser${numOfLasers}`, //give the laser a unique id
        owner: elemID,
        x: Number(alienX),
        y: Number(alienY),
        dead: false
      } 
      //Return new laser state 
      return newLaser;
    }
  }

     //From Ref[6]. Return true if r1 and r2 intersect
  function rectsIntersect(r1 : DOMRect, r2: DOMRect): boolean {
    return !(
      r2.left > r1.right ||
      r2.right < r1.left ||
      r2.top > r1.bottom ||
      r2.bottom < r1.top
    );
  }
  

  //Pure function. This function will return a laser state that has collided with this entity or 
  //null if no collision. elemID is the string ID name of the element (which is the same as name found in the
  //document or in the game state)
  function checkShot(state: GameState, elemID: string): LaserState|null{

    //Get the rect for this element
    const elemRect = document.getElementById(elemID).getBoundingClientRect();
    const lasers = state.laserStates.filter(laser => laser.dead === false); //Keep only the live lasers to check

    //get the interested lasers. If we are checking for an alien state, we get all the lasers from the ship,
    //otherwise we get the lasers from the alien.
    const interestedLasers = (elemID !== "ship" )? lasers.filter(laser => laser.owner === "ship") 
                    : lasers.filter(laser => laser.owner !== "ship")
    

    //Check for every interested laser whether there is a collision between the laser and the element                
    let collidedLaser = null;
    interestedLasers
      .forEach(laser => {      
        const collide = rectsIntersect(elemRect,  document.getElementById(laser.id).getBoundingClientRect())
      
        if (collide === true){ //if collided with an elem
          collidedLaser = laser; 
        }})
    return collidedLaser;
  }
  

  //------------------------------------Alien stuff-------------------------------------//

  //update view of a single alien to the new state. Not pure. 
  //But its ok because called through subscribe to give effect
  function updateViewAlien(state:AlienState): void {
    const aliens = document.getElementById(state.id)!;
    if (state.dead === true){
      aliens.setAttribute("display", "none");   //stop displaying the alien if it died
    }  
    else if (state.dead === false){  //if the alien is not dead, move the html element
      //alienStartState is the x,y coordinates of where this alien started
      const alienStartState = initialGameState.aliens.find(alien => alien.id === state.id); 
      //Need to minus the alien start state because it might not be starting at x=0,y=0 coordinates. Prevent going out of canvas
      aliens.setAttribute('transform',`translate(${(state.x - alienStartState.x)} ${state.y - alienStartState.y})`);

    }    
  }

  //update view of all aliens. Not pure because calls updateViewAlien or showGameOver. 
  //But its ok because called through subscribe to give effect
  function updateViewAliens(state:GameState): void {  

    //check if any states have reached close to the bottom of the map. If too close, player will lose
    state.aliens.filter(alien => alien.y >= Constants.CANVAS_HEIGHT -30 || alien.y >= Constants.CANVAS_HEIGHT +30 ).length > 0 ? showGameOver('lose',state) : {};

    //check if all aliens are alive
    const numOfAliveAliens = state.aliens.filter(state => state.dead === false).length;
    numOfAliveAliens !== 0 ?  //if there are still aliens alive, continue
      state.aliens.forEach(alien => updateViewAlien(alien)): //Call the helper function to update the alien location
      showGameOver('win',state); //else show game over  
  }

  //Ref[4]. Creating a new object/type for each elem in array. Pure function because each elem is new and map returns a new array of states.
  function alienTransitions(state:GameState, delta: number) : GameState{
    let shotAliens = [] //keep track of the shot aliens
    let collidedLaserList = [];//keep track of the collided lasers
    state.aliens.forEach(alien=> //for each alien, check if it has been shot
      {
        const collidedLaser = checkShot(state,alien.id);
        // check if a laser has killed something for the first time. Ignore it if it has killed another alien
        if (collidedLaser !== null && !collidedLaserList.includes(collidedLaser)){ 
          collidedLaserList.push(collidedLaser);
          shotAliens.push(alien) //if the alien is shot put it to the list
        }
      } 
    )

    //get the lasers that are still alive
    const liveLasers =  state.laserStates.filter(state => !collidedLaserList.includes(state)) 

    //For each of the collided lasers, set it to dead
    collidedLaserList = collidedLaserList.map( laser => 
      <LaserState>{...laser,
        dead: true
      }
    )
    
    return { ...state, //not changing any other game states
      //if there are no collided lasers with aliens, remain the same laser states, else concat the live lasers with the modifield collided lasers
      laserStates: collidedLaserList.length === 0? state.laserStates: liveLasers.concat(collidedLaserList),
      
      aliens: state.aliens.map(    //For each alien state, update its states position
        alien => //for each alien state, map it to a new state
        ({ ...alien,
          //We are ignoring the user generated movements (-1,0,1). If user presses this button it will not affect changes of alien movement  
          x: delta !== 0? alien.x:((alien.x + Constants.ALIEN_X_DELTA) % Constants.CANVAS_WIDTH), //move right and wrap around
            y: delta !== 0? alien.y:alien.x + Constants.ALIEN_X_DELTA >= Constants.CANVAS_WIDTH ? (alien.y + Constants.ALIEN_Y_DELTA) % Constants.CANVAS_HEIGHT: alien.y, //if the aliens move until the right end of screen, move them down by ydelta
            //only live aliens can shoot
            fire: alien.dead === false? Math.random() < Constants.ALIEN_SHOOT_PROB : false,
            //if the alien is alive, check if it has been shot
            dead: alien.dead === false? shotAliens.includes(alien) : true //if its found in the list, it has been shot and thus dead    
        }) 
      )
    }
  }
    

  //-------------------------------------------Ship stuff-------------------------------------------------//
        
  //function which controls the left/right movement. Returns a new GameState object. Pure function.
  function shipTransitions(state:GameState, delta:number): GameState {

    const laserCollided = checkShot(state,state.ship.id);    //check if the ship has collided with any alien's laser 
    return { ...state, //Not changing anything that is not the ship
      ship: { ...state.ship,    //Change the ship state
        //xDelta can be -1 (move left), 0 (not moving), 1 (move right), 2 (firing). Use modulus 2 to get the x coordinate changes
        x: ((state.ship.x+ (delta%2) % Constants.CANVAS_WIDTH) + Constants.CANVAS_WIDTH) %Constants.CANVAS_WIDTH, //Ensure mod has no -ve result. Ref[2]
        fire: delta === 2? true: false, //if this ship is firing (xDelta = 2)
        dead: laserCollided === null? false: true   //if no collision with a laser, not dead, else dead
      }
    }
  }
    
  //Ref[1] Update the ship html element. Unpure. Used as final action to show effect of changing states
  function updateViewShip(state:GameState): void {

    if (state.ship.dead === true){
      removeElemFromCanvas(state.ship.id); //if the ship is dead, remove it from canvas
      showGameOver('lose',state);      //show game over button if the ship is dead
    }
    else{ //if not dead, more the ship to new state (wrap around the canvas)
      const ship = document.getElementById("ship")!; 
      ship.setAttribute('transform',`translate(${state.ship.x%Constants.CANVAS_WIDTH} ${state.ship.y})`) ; 
    }
  }

  //-----------Ship Observables-------------//
  //Each time the player shoots (presses space key) it will produce 2
  const shipShoot$ = fromEvent<KeyboardEvent>(document,'keydown')
  .pipe(
    sampleTime(500),
    filter(({repeat})=>!repeat),   //remove repeat
    filter(e => e.key === ' ' ),     //The shoot is using spacebar
    map(_ => 2))   //map to 2 for fire  

  //From ref[1]. This is to create observables for left and right arrows (-1 for left, +1 for right)
  const shipMovement$ = fromEvent<KeyboardEvent>(document,'keydown')
  .pipe(
    filter(({repeat})=>!repeat),   //remove repeat
    filter(({code})=>code=== 'ArrowLeft' || code=== 'ArrowRight'),   //filter to get the left and right
    mergeMap(d=>interval(1).pipe(    //take the stream of data at an interval of 1 ms. 
      takeUntil(    //take the values only when holding down
        fromEvent<KeyboardEvent>(document,'keyup').pipe(
          filter( ({code})=>code  === d.code))), //filtered to ignore keys other than the one that initiated the 'keydown'
        map(_=>d))), //If move arrowleft then move xcoordinates of ship to -1 
      map(({code}) => code === 'ArrowLeft'? -1:1)
      )
  

  //------------------------------------Subscriptions/Main routine----------------------------------------//

  //Look here to understand the whole concept of the game structure.
  //Effective codes. Will continue to subscribe with effect while the game is not over
  //Ship movement will create -1 or 1 based on key down arrow movements. If its not moving, its 0 for stationary. 2 for shooting
  const gameShipObservables$ = merge(gameClock.pipe(map(_ => 0)), shipMovement$, shipShoot$);


  //Pure function which move the game along. It will change the states of the game.
  //xDelta either -1 (ship move left), 0 (game tick), 1 (ship move right), 2 (ship shoots)
  function gameTransitions(state: GameState, delta: number): GameState{
    
    //Each transition will perform its pure state changing functions 
    //changes in order:
    //move lasers -> move aliens -> move ship -> fire lasers -> update player score
    return playerScoreTransitions(fireLasers(shipTransitions(alienTransitions(laserTransitions(state,delta),delta),delta)));
  }

  //Update the view of the game. Impure function which will call all the other update view functions
  function updateViewGame(gameState: GameState): void{

    updateViewLasers(gameState);
    updateViewShip(gameState);
    updateViewAliens(gameState);
    updateViewScore(gameState);    
  }


  //Main subscription to run the game.\
  gameShipObservables$.pipe(scan(gameTransitions,initialGameState)).subscribe(updateViewGame);
  



  //------------------------------------show win/lose stuff-----------------------------------//
  //Impure function which shows the game over button which allows the user to replay
  function showGameOver(event: Event, game: GameState){
    if (event === "lose"){
      //Show a window for game over (lose)
      const gameOverButton =  document.querySelector(".game-over");
      (gameOverButton as HTMLElement).style.display = "inline" ;
    }
    else{
      game.laserStates.forEach(laser => removeElemFromCanvas(laser.id)); //clean left-over lasers before next round
      if (Constants.CURRENT_LEVEL === 10){ //if finish all levels
        //Show a window for game over (win) after completing all levels
        const gameOverButton =  document.querySelector(".congratulations");
        (gameOverButton as HTMLElement).style.display = "inline" ;
       }
       else{ //if can proceed to next level
        updateLevel(); //update the level in html
        spaceinvaders(Constants.CURRENT_LEVEL + 1,Constants.ALIEN_SHOOT_PROB + 0.001, Constants.ALIEN_LASER_SPEED + 0.25,
          Constants.ALIEN_X_DELTA + 0.01, Constants.PLAYER_LASER_COOLDOWN - 0.01, Constants.PLAYER_LASER_SPEED + 0.5); //progressing to next level 
      }
    }
  }
}


  //------------------------------------show key highlight stuff-----------------------------//

  //highlight the keys if pressed. Ref[1]. Impure function to show highlights
  function showKeys() {
    function showKey(elementId,keyCode) {
      fromEvent<KeyboardEvent>(document,'keydown') //if keydown, filter only the interested keys. Then add highlight
        .pipe(filter(e=>e.key === keyCode))
        .subscribe(()=>{
          const arrowKey = document.getElementById(elementId)!;
          arrowKey.classList.add("highlight");
        })
      fromEvent<KeyboardEvent>(document,'keyup') //if keyup, filter only the interested keys. Then remove highlight
        .pipe(filter(e=>e.key === keyCode))
        .subscribe(()=>{
          const arrowKey = document.getElementById(elementId)!;
          arrowKey.classList.remove("highlight");
        })
    }
    showKey("leftarrow","ArrowLeft");    
    showKey("rightarrow","ArrowRight");
    showKey("space"," ");
  }



  // the following simply runs your pong function on window load.  Make sure to leave it in place.
  if (typeof window != 'undefined')
  
    window.onload = ()=>{
      //starting arguments: current level of game = 1, alien probability to shoot = 0.001, 
      //alienLaserSpeed = 1, alien move speed = 1, player laser cooldown = 0.5 second, player laser speed = 6
      spaceinvaders(1,0.001,1,1, 500, 6);
      showKeys();
    }
  
  


