module.exports = function () {
  var keypress = require('keypress');
  var Scrambo = require('scrambo');
  var Stopwatch = require('timer-stopwatch');
  var clc = require('cli-color');

  var solveUtils = require('./solve-utils');
  var charm = solveUtils.getCharm();

  var threebythree = new Scrambo();

  var this_scramble = {};
  var this_solve = {};
  var stats = {};

  const STATS_LINES = 11;

  function prepNewSolve() {
    solveUtils.userSay('Press space to initiate a solve.');
    this_scramble = threebythree.get(1).join(' ');
    solveUtils.botSay(this_scramble);
  }

  function endSolve() {
    stopwatch.stop();

    stopwatch.reset(0);
    post_inspect.reset(0);
    inspect.reset(0);

    solveUtils.eraseInspectSolveLines();
  }

  function resetForNextSolve() {
    endSolve();

    inspecting = false;
    post_inspecting = false;
    solving = false;
    post_solving = false;

    penalty = 0;
  }

  function addToStatsModule(solveTime) {
    if(typeof solveTime !== 'number') {
      return;
    }

    this_solve = (solveTime / 1000.0).toFixed(2);
    solves_today.push(parseFloat(this_solve));
    num_solves += 1;

    stats = calcStats(solves_today);
    ao5 = stats.ao5;
    ao12 = stats.ao12;
    ao_session = stats.ao_session;
    best_time = stats.best_time;
    worst_time = stats.worst_time;
  }

  keypress(process.stdin);

  var inspect_options = {
    refreshRateMS: 1000,
    almostDoneMS: 8000
  };

  var inspect = new Stopwatch(15000, inspect_options);
  var post_inspect = new Stopwatch(2000);
  var stopwatch = new Stopwatch();

  var onInspectTimeFunction = function (time) {
    if(!inspect.hasBeenStopped) {
      charm.position(1, solveUtils.getStartInspect()).write('Inspecting: ' + String('00' + (time.ms / 1000).toFixed()).slice(-2));
    }
  };

  var onInspectDoneFunction = function () {
    var start_inspect = solveUtils.getStartInspect();

    charm.position(1, start_inspect);
    charm.erase('end');
    charm.position(1, start_inspect + 1);
    charm.erase('end');
    charm.position(1, start_inspect);
    console.log(clc.red('Penalty! +2s'));
    inspecting = false;
    post_inspecting = true;
    post_inspect.start();
  };

  var onPostInspectDoneFunction = function () {
    var start_inspect = solveUtils.getStartInspect();

    charm.position(1, start_inspect);
    charm.erase('end');
    charm.position(1, start_inspect + 1);
    charm.erase('end');
    charm.position(1, start_inspect);
    console.log(clc.red('This solve is a DNF.'));

    resetForNextSolve();
    writeLocal('DNF', this_scramble);
    charm.position(1, start_inspect);
    solveUtils.botSay('That solve was ' + clc.green('DNF'));
    prepNewSolve();

    solveUtils.setStartInspect(start_inspect + 3);
    solveUtils.setStartSolve(solveUtils.getStartSolve() + 3);
    last_solve = 'DNF';

  };

  inspect.on('time', onInspectTimeFunction);
  inspect.on('done', onInspectDoneFunction);

  post_inspect.on('done', onPostInspectDoneFunction);

  var onStopwatchTimeFunction = function (time) {
    if(!solving) {
      return;
    }
    charm.position(1, solveUtils.getStartSolve()).write('Solving: ' + (time.ms / 1000).toFixed(2));
  };

  stopwatch.on('time', onStopwatchTimeFunction);

  var stats = require('./solvestats-module.js');
  var calcStats = stats.calcStats;

  var push = require('./file-module.js');
  var writeLocal = push.writeLocal;

  /**
   * Cache for Solves
   */
  var solveSink = [];

  var inspecting = false;
  var post_inspecting = false;
  var solving = false;
  var post_solving = false;

  var last_solve = -1;
  var penalty = 0;

  var num_solves = 0;
  var solves_today = [];
  var ao5 = 0.0;
  var ao12 = 0.0;
  var ao_session = 0.0;
  var best_time = 0.0;
  var worst_time = 0.0;

  var pushSolveSink = function (solveTime, scramble) {
    solveSink.push({solveTime: solveTime, scramble: scramble});
  }

  var flushSolveSink = function () {
    if(solveSink.length <= 0) {
      return;
    }

    for(var i = 0; i < solveSink.length; i++) {
      writeLocal(solveSink[i].solveTime, solveSink[i].scramble);
    }

    solveSink = [];
  }

  var exitApplication = function () {
    console.log("\n\n" + clc.green("SESSION ENDED. Session stats follow:") + "\n\n");
    solveUtils.print_stats(start_time, total_time.ms, solves_today.length, ao5, ao12, ao_session, best_time, worst_time);
    return process.exit(0);
  }

  var showStatistics = function () {
    charm.erase('line');
    charm.left(1);

    var printed = solveUtils.print_stats(start_time, total_time.ms, solves_today.length, ao5, ao12, ao_session, best_time, worst_time);

    solveUtils.userSay('Press space to initiate a new solve');

    solveUtils.setStartSolve(STATS_LINES + printed.solve);
    solveUtils.setStartInspect(STATS_LINES + printed.inspect);
  }

  var startInspection = function () {
    inspect.start();
    inspecting = true;
  }

  var startSolving = function () {
    inspect.stop();
    inspect.reset(0);
    stopwatch.start();
    inspecting = false;
    solving = true;
  }

  var startSolvingWithPenalty = function () {
    post_inspect.stop();
    inspect.reset(0);
    post_inspect.reset(0);
    stopwatch.start();
    post_inspecting = false;
    solving = true;
    penalty = 2000;
  }

  var resetSolve = function () {
    flushSolveSink();

    prepNewSolve();

    resetForNextSolve();
  }

  var finishSolving = function () {
    var solveTime = stopwatch.ms;

    solveTime = solveTime + penalty;

    addToStatsModule(solveTime);

    pushSolveSink(this_solve, this_scramble);

    endSolve();

    charm.position(1, solveUtils.getStartInspect());
    solveUtils.botSay('That solve was ' + clc.green(solveUtils.prettify(solveTime)) +
      (penalty === 0 ? ' (OK)' : clc.red(' (+2)')));

    if(num_solves > 1) {
      charm.position(solveUtils.getRightRowNum(), solveUtils.getStartInspect());
      console.log(clc.red(num_solves < 5 ? 'Previous solve: ' : "This session's AO5: ") +
        clc.blue(typeof last_solve === 'number' ? solveUtils.prettify(num_solves < 5 ? last_solve : ao5) : 'DNF'));
    }

    solveUtils.writeAt(1, solveUtils.getStartInspect() + 1, 'How did you fare? Press + to add penalty, d to set DNF or space to continue')

    last_solve = solveTime;
  }

  var handlePostSolve = function (withPenalty, didNotFinish) {
    if(!inspecting && !post_inspecting && !solving && !post_solving) {
      return;
    }

    if(solveSink.length <= 0) {
      return;
    }

    var lastSolveTime = solveSink[solveSink.length - 1].solveTime;

    if(withPenalty) {
      //  If the cube can be solved with one turn,
      // then 2 seconds is added onto the time

      if(!isNaN(lastSolveTime)) {
        lastSolveTime = parseFloat(lastSolveTime) + 2000;
      }

    }

    if(didNotFinish) {
      lastSolveTime = 'DNF';
    }

    solveSink[solveSink.length - 1].solveTime = lastSolveTime;

    resetSolve();
  }

  var handleSolve = function () {
    if(!inspecting && !post_inspecting && !solving && !post_solving) {
      // A new solve has been initiated
      startInspection();

      return;
    }

    if(inspecting && !post_inspecting && !solving && !post_solving) {
      // Inspection ends, solving begins
      startSolving();

      return;
    }

    if(!inspecting && post_inspecting && !solving && !post_solving) {
      // Inspection has ended, with a penalty of +2
      // Solving begins
      startSolvingWithPenalty();

      return;
    }

    if(!inspecting && !post_inspecting && solving && !post_solving) {
      // Solving has ended
      finishSolving();

      return;
    }

    if(!inspecting && !post_inspecting && !solving && post_solving) {
      resetSolve();

      return;
    }
  }

  var onKeypressFunction = function (char, key) {
    var keySet = typeof (key) === 'object' && key.hasOwnProperty('name');
    var keyInput = null;

    if(keySet) {
      keyInput = key.name;

      if(key.ctrl && key.name === 'c') {
        process.stdin.pause();
      }
    } else {
      keyInput = char;
    }

    switch(keyInput) {
      case 'e':
        exitApplication();
        break;

      case 's':
        showStatistics();
        break;

      case 'space':
        handleSolve();
        break;
      case '+':
        handlePostSolve(true, false);
        break;
      case 'd':
        handlePostSolve(false, true);
        break;
      default:
      // do nothing
    }
  };

  process.stdin.on('keypress', onKeypressFunction);

  process.stdin.setRawMode(true);
  process.stdin.resume();

  solveUtils.writeIntroduction();
  prepNewSolve();

  solveUtils.addControlsHint();

  var start_time = new Date();
  start_time = start_time.getHours() + ':' + start_time.getMinutes();

  var total_time = new Stopwatch();
  total_time.start();
  charm.position(1, solveUtils.getStartInspect());
};
