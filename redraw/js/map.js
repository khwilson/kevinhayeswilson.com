/* Translation maps */

/* Return a query parameter from a URL */
var getParameterByName = function (name, url) {
  if (!url) {
    url = window.location.href;
  }
  name = name.replace(/[\[\]]/g, "\\$&");
  var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
      results = regex.exec(url);
  if (!results) return null;
  if (!results[2]) return '';
  return decodeURIComponent(results[2].replace(/\+/g, " "));
}

/* Splits based on 2012 vs 2016 data */

var year = null,
    loser = null,
    dataFile = null,
    data = {},
    partyToCandidate = null;

var setYear = function(newYear) {
  if (newYear === '2012') {
    year = newYear;
    dataFile = 'data/us2012.json';
    partyToCandidate = {
      'dem': 'Barack Obama',
      'gop': 'Mitt Romney',
      'grn': "Green Party",
      'lib': 'Gary Johnson',
      'una': 'Unaffiliated',
      'oth': 'Other'
    }
    loser = 'Mitt Romney';
  } else if (newYear === '2016i') {
    year = newYear;
    dataFile = 'data/us2016income.json';
    partyToCandidate = {
      'dem': 'Hillary Clinton',
      'gop': 'Donald Trump',
      'grn': "Jill Stein",
      'lib': 'Gary Johnson',
      'una': 'Evan McMullin',
      'oth': 'Other'
    }
    loser = 'Hillary Clinton';
  } else {
    year = newYear;
    dataFile = 'data/us.json';
    partyToCandidate = {
      'dem': 'Hillary Clinton',
      'gop': 'Donald Trump',
      'grn': "Jill Stein",
      'lib': 'Gary Johnson',
      'una': 'Evan McMullin',
      'oth': 'Other'
    }
    loser = 'Hillary Clinton';
  }
}

if (getParameterByName('year') === '2012') {
  setYear('2012');
} else if (getParameterByName('year') === '2016i') {
  setYear('2016i');
} else {
  setYear('2016');
}

var numberToLetter = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

var letterToNumber = {};
for (var i=0; i<numberToLetter.length; ++i) {
  letterToNumber[numberToLetter[i]] = i;
}
var countyToState = {}

var STATE_ABBREVS = [
  'AL', 'AK',
  'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY'];

var stateToNumber = {};
for (var i=0; i<STATE_ABBREVS.length; ++i) {
  stateToNumber[STATE_ABBREVS[i]] = i;
}

var tableHeaders = ['population', 'electors', 'dem', 'gop', 'lib', 'grn', 'una', 'oth'];


/* Global state variables */
var currentMode = 'pickup';
var countyMode = 'show';
var showStateColors = true;
var stateTotals = {}

/* Data: Read once and store */
var us = null;


var switchModeButton = d3.select('#switchModeButton').html('<u>M</u>ove');
var switchModeFunction = function() {
  if (currentMode === 'pickup') {
    switchModeButton.html('Cancel <u>m</u>ove').classed('btn-danger', false).classed('btn-warning', true);
    currentMode = 'dropoff';
  } else {
    switchModeButton.html('<u>M</u>ove').classed('btn-danger', true).classed('btn-warning', false);
    currentMode = 'pickup';
  }
}
switchModeButton.on('click', switchModeFunction);
// keyboard shortcut to activate moving counties
d3.select("body").on("keydown", function(ev) {
  if (d3.event.keyCode==77) {
    switchModeFunction()
  };
});

var countyModeButton = d3.select("#countyModeButton").html("Hide Counties");
var countyModeFunction = function () {
  if (countyMode === 'show') {
    countyMode = 'hide';
    countyModeButton.html("Outlines Only");
    g.selectAll("path").remove();
    update();
  } else if (countyMode === 'hide' && showStateColors) {
    showStateColors = false;
    countyModeButton.html("Show Counties");
    g.selectAll("path").remove();
    update();
  } else {
    countyMode = 'show';
    showStateColors = true;
    countyModeButton.html("Hide Counties");
    g.selectAll("path").remove();
    update();
  }
}
countyModeButton.on('click', countyModeFunction);

var width = parseInt(d3.select('#states-div').style('width')),
    mapRatio = 0.5,
    height = width * mapRatio;

var projection = d3.geo.albersUsa().scale(width).translate([width / 2, height / 2]);
var path = d3.geo.path().projection(projection);
var allExists = false;
var smallScale = true;

/* County detail tooltip */
var tooltip = d3.select('body').append('div')
            .attr('class', 'hidden tooltip');

var tooltipInner = tooltip.append('div').attr('class', 'tooltip-inner');
var tooltipTitle = tooltipInner.append('div').attr('class', 'tooltip-title');
var tooltipTable = tooltipInner.append('div').attr('class', 'tooltip-content').append('table').attr('class', 'table county-results');
var tooltipTr = tooltipTable.append('thead').append('tr')
tooltipTr.append('th').html('Candidate');
tooltipTr.append('th').html('Votes');
tooltipTr.append('th').html('Pct.');
var tooltipTbody = tooltipTable.append('tbody');

var margin = {top: -5, right: -5, bottom: -5, left: -5},
    width = 960 - margin.left - margin.right,
    height = 500 - margin.top - margin.bottom;

var zoom = d3.behavior.zoom()
    .scaleExtent([1, 10])
    .on("zoom", zoomed);

var svg = d3.select("#states-svg")
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
//            .attr('viewBox', '0 0 ' + width + ' ' + height)
  .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.right + ")")
    .call(zoom);

var rect = svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .style("fill", "none")
    .style("pointer-events", "all");

var g = svg.append('g');

/* On update, compute the number of electors a state would get.
 * Uses 2010 Census data and the algorithm described here:
 * https://en.wikipedia.org/wiki/United_States_congressional_apportionment#The_method_of_equal_proportions
 *
 * @updates stateTotals
 */
var computeElectors = function() {
  var priorities = [];
  var allocated = 0;
  var maxElectors = 435; // Start with assumption that all states have zero population
  for (var state of STATE_ABBREVS) {
    if (stateTotals[state].population > 0) {
      // All states, DC included, get a minimum of 3 electors
      stateTotals[state].electors = 3;
      // Increase the maximum number of electors by the number of senators for each state.
      // For DC, must also add the phantom "representative".
      // 435 representatives plus 2 senators for 50 states plus 3 electors for DC equals 538.
      (state !== 'DC') ? maxElectors += 2 : maxElectors +=3;
    } else {
      stateTotals[state].electors = 0;
    }
    allocated += stateTotals[state].electors;
    if (state !== 'DC') {
      // DC doesn't get any more electors than the least populous state,
      // which for the lifespan of this tool we can safely assume to be 3.
      priorities.push({key: state, val: stateTotals[state].population / Math.sqrt(2)});
    }
  }
  priorities.sort(function(a, b) {
    if (a.val === b.val) {
      return 0;
    }
    return a.val < b.val ? 1 : -1;
  });
  while (allocated < maxElectors) {
    var nextUp = priorities[0];
    var nextState = stateTotals[nextUp.key];
    nextState.electors += 1;
    allocated += 1;
    nextUp.val = nextState.population / Math.sqrt((nextState.electors - 2) * (nextState.electors - 1));
    priorities.sort(function(a, b) {
      if (a.val === b.val) {
        return 0;
      }
      return a.val < b.val ? 1 : -1;
    });
  }
}

/* Utilities */

/* If obj has prop as a property, return the value. Else return 0. */
var hasOrZero = function(obj, prop) {
  if (obj.hasOwnProperty(prop)) {
    return obj[prop];
  } else {
    return 0;
  }
}

/* Return the integer d with commas at thousands places */
var intWithCommas = function(d) {
  return d.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

var getColorClass = function(d) {
  if (d.properties.hasOwnProperty('state')) {
    var s = stateTotals[d.properties.state];
    if (s.dem > s.gop) {
      var demPercent = Math.floor(d.properties.dem / (d.properties.gop + d.properties.dem) * 20) * 5;
      if (demPercent < 50) {
        demPercent = 'less-than-50';
      }
      return 'dem-' + demPercent;
    } else {
      var demPercent = Math.floor(d.properties.dem / (d.properties.gop + d.properties.dem) * 20) * 5;
      if (demPercent >= 50) {
        demPercent = 'greater-than-50';
      }
      return 'dem-' + demPercent;
    }
  } else {
    return "black";
  }
}

/**** D3 ****/

/* The main D3 update loop */
var update = function(resizeUpdate) {
  /* Update elector numbers */
  computeElectors();

  /* Details table rendering */
  var tr = d3.select('#states')
    .selectAll("tr")
      .data(STATE_ABBREVS);

  tr.enter().append("tr");
  var td = tr.selectAll("td")
    .data(function (d, i) {
      var state = stateTotals[STATE_ABBREVS[i]];
      return [STATE_ABBREVS[i], state.population, state.electors,
              state.dem, state.gop, state.grn, state.lib, state.una, state.oth];
    });

  td.enter()
    .append("td");

  td.text(function (d, i) { return intWithCommas(d); })
    .attr("class", function(d, i) {
      if (i === 0) {
        return stateTotals[d].dem > stateTotals[d].gop ? "blue-state" : "red-state";
      } else {
        return null;
      }
    });
  td.exit().remove();
  tr.exit().remove();

  /* Draw United States with colors! */
  var mapPath;

  if (countyMode === 'show') {
    // We do a full, county level rendering
    mapPath = g.selectAll("path.county-path")
     .data(topojson.feature(us, us.objects.counties).features);

    var updateMapPath = null;
    if (resizeUpdate) {
      updateMapPath = mapPath;
      mapPath.enter().append('path');
    } else {
      updateMapPath = mapPath.enter().append('path');
    }
    updateMapPath
      .attr("d", path)
      .on("click", function(d) {
        if (d3.event.defaultPrevented) return; // We're zooming
        if (currentMode === 'pickup') {
          // Select or deselect the county
          var me = d3.select(this);
          if (me.classed('selection-color')) {
            me.classed(getColorClass(d), true);
            me.classed("selection-color", false);
          } else {
            me.classed(getColorClass(d), false);
            me.classed("selection-color", true);
          }
        } else if (currentMode === 'dropoff') {
          // Move the counties into their new state
          var newState = d.properties.state;
          var newStateData = stateTotals[newState];
          d3.selectAll("path.selection-color")
            .each(function(dd) {
              var oldState = dd.properties.state;
              dd.properties.state = newState;
              var oldStateData = stateTotals[oldState];
              for (var i=0; i<tableHeaders.length; ++i) {
                var key = tableHeaders[i];
                newStateData[key] += hasOrZero(dd.properties, key);
                oldStateData[key] -= hasOrZero(dd.properties, key);
              }
            });
          update();
          switchModeFunction();
        }
      })
      .on('mousemove', function(d) {
        // Show county level detail
        var mouse = d3.mouse(g.node()).map(function(d) {
          return parseInt(d);
        });

        tooltip.classed('hidden', false)
          .attr('style', 'left:' + (d3.event.pageX + 15) + 'px; top:' + (d3.event.pageY - 15) + 'px');
      })
      .on('mouseover', function(d) {
        // Initialize the county level detail
        var theHeading = tooltipTitle.selectAll(".tooltip-title-heading").data([d.properties.name]);
        theHeading.enter().append("div").attr('class', 'tooltip-title-heading');
        theHeading.html(function(dd) { return dd; });

        var theSubHeading = tooltipTitle.selectAll(".tooltip-title-state-heading").data([d.properties.state]);
        theSubHeading.enter().append('div').attr('class', 'tooltip-title-state-heading');
        theSubHeading.html(function(dd) { return dd; });

        let thisData = [];
        let total = 0;
        for (var party in partyToCandidate) {
          var partyTotal = hasOrZero(d.properties, party);
          if (partyTotal > 0) {
            thisData.push([partyToCandidate[party], partyTotal]);
            total += partyTotal;
          }
        }
        var theData = tooltipTbody.selectAll("tr")
          .data(thisData);
        theData.enter().append('tr')
        var theRow = theData.selectAll("td").data(function(dd, i) {
          return [dd[0], dd[1], (100 * dd[1] / total).toFixed(2) + '%'];
        });
        theRow.enter().append('td');
        theRow.html(function(elt, i) { return i === 0 ? elt : intWithCommas(elt); })
        theRow.exit().remove();
        theData.exit().remove();
      })
      .on('mouseout', function() {
        // Hide the county level detail
        tooltip.classed('hidden', true);
      });

    // Actually color the map
    mapPath.attr("class", function(d) { return "county-path " + getColorClass(d); });
  }

  // Draw state boundaries
  mapPath = g.selectAll("path.state-boundary")
    .data(d3.nest()
            .key(function(d) { return d.hasOwnProperty('properties') ? (d.properties.state || 'other') : 'other'; })
            .entries(us.objects.counties.geometries));

  mapPath.enter().append("path")
    .attr("class", "state-boundary state-boundary-filled");

  mapPath.attr("d", function(d) { return path(topojson.merge(us, d.values)); });
  if (countyMode === 'hide' && showStateColors) {
    // If we're hiding the counties, we want to color whole states
    mapPath.attr('class', function (d) {
      if (stateTotals.hasOwnProperty(d.key)) {
        var s = stateTotals[d.key];
        var dem = hasOrZero(s, 'dem');
        var gop = hasOrZero(s, 'gop');
        var demPercent = Math.floor(dem / (dem + gop) * 20) * 5;
        return "state-boundary dem-" + demPercent + '-state';
      } else {
        return 'state-boundary';
      }
    });
  }

  // Recompute the total number of electoral votes
  var demTotal = 0;
  var gopTotal = 0;
  var totalElectors = 0;
  for (var i=0; i<STATE_ABBREVS.length; ++i) {
    var state = STATE_ABBREVS[i];
    var s = stateTotals[state];
    totalElectors += s.electors;
    if (s.dem > s.gop) {
      demTotal += s.electors;
    } else {
      gopTotal += s.electors;
    }
  }

  // Color and fill in EV bar
  d3.select('.ev-bar').attr('style', 'background: linear-gradient(to right, #179ee0 0%, #179ee0 ' + (demTotal / totalElectors * 100) + '%, #ff5d40 ' + (demTotal / totalElectors * 100) + '%, #ff5d40 100%)');
  $(".ev-bar-dem-total").text(demTotal);
  $(".ev-bar-gop-total").text(gopTotal);
}

/* Read data once! */
var reset = function(dataFile, useUrl) {
  if (dataFile in data) {
    execReset(data[dataFile], useUrl);
  } else {
    d3.json(dataFile, function(error, usData) {
      if (error) throw error;
      data[dataFile] = usData;
      execReset(usData, useUrl);
      allExists = true;
    });
  }
}

var execReset = function(usData, useUrl) {
  us = usData;
  stateTotals = {};

  for (var i=0; i<STATE_ABBREVS.length; ++i) {
    stateTotals[STATE_ABBREVS[i]] = {population: 0,
                                     electors: 0,
                                     color: 1,
                                     dem: 0, gop: 0, grn: 0, lib: 0, una: 0, oth: 0};
  }

  g.selectAll('path').remove();
  d3.selectAll('#states>tr').remove();
  $("#lede").html("How few counties can you move to make " + loser + " win the " + year + " election?");

  if (useUrl) {
    var shareParameter = getParameterByName('share');
    if (shareParameter) {
      us.objects.counties.geometries.sort(function(x, y) {
        if (x.id < y.id) {
          return -1;
        } else if (x.id > y.id) {
          return 1;
        } else {
          return 0;
        }
      });
      for (var i=0; i<shareParameter.length; ++i) {
        var num = letterToNumber[shareParameter[i]];
        var geom = us.objects.counties.geometries[i];
        if (!geom) {
          console.log("problem ", i);
        }
        if (num !== 51 && geom && geom.hasOwnProperty('properties')) {
          geom.properties.state = STATE_ABBREVS[num];
        }
      }
    }
  }

  for (var i=0; i<us.objects.counties.geometries.length; ++i) {
    var county = us.objects.counties.geometries[i];
    if (!county.hasOwnProperty('properties') || !county.properties.hasOwnProperty("state")) {
      // There are a few numbers in the 72000s which appear to be part of nothing in particular.
      continue;
    }
    countyToState[county.id] = county.properties.state;
    var state = stateTotals[county.properties.state];
    state.population += hasOrZero(county.properties, 'population');
    state.dem += hasOrZero(county.properties, 'dem');
    state.gop += hasOrZero(county.properties, 'gop');
    state.grn += hasOrZero(county.properties, 'grn');
    state.lib += hasOrZero(county.properties, 'lib');
    state.una += hasOrZero(county.properties, 'una');
    state.oth += hasOrZero(county.properties, 'oth');
  }

  update();
}

reset(dataFile, true);


/**** Sharing ****/

/* Turn map into URL */
var getShareUrl = function() {
  us.objects.counties.geometries.sort(function(x, y) {
    if (x.id < y.id) {
      return -1;
    } else if (x.id > y.id) {
      return 1;
    } else {
      return 0;
    }
  });
  shareUrl = [];
  for (var i=0; i<us.objects.counties.geometries.length; ++i) {
    var geom = us.objects.counties.geometries[i];
    if (geom.hasOwnProperty('properties')) {
      shareUrl.push(numberToLetter[stateToNumber[geom.properties.state]]);
    } else {
      shareUrl.push(numberToLetter[51]);
    }
  }
  var baseUrl = window.location.origin + window.location.pathname + '?';
  if (year !== '2016') {
    baseUrl += 'year=' + year + '&';
  }
  return baseUrl + 'share=' + shareUrl.join('');
}

/* Setup sharing URL in the share box */
var doShare = function() {
  d3.select("#clipboard-target").attr("value", getShareUrl());
}

$("#shareGroup").hide();

$("#shareButton").popover({
  container: 'body',
  content: $("#shareGroup"),
  title: "Copy URL to Share",
  html: true,
  placement: "left",
  trigger: "focus"
}).on('show.bs.popover', function() { doShare(); $("#shareGroup").show(); });

var clipboard = new Clipboard('[data-clipboard-tooltip]');
clipboard.on('success', function(e) {
  e.clearSelection();
  console.info('Action:', e.action);
  console.info('Text:', e.text);
  console.info('Trigger:', e.trigger);
});

$("#selectYear").change(function() {
  var newYear = null;
  $("#selectYear>option:selected").each(function() {
    newYear = this.value;
  });
  setYear(newYear);
  reset(dataFile, false);
});

function zoomed() {
  g.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
  if (smallScale && (d3.event.scale > 3)) {
    smallScale = false;
    d3.selectAll('path').style('stroke-width', '0.1px');
    console.log("become large");
  } else if (!smallScale && (d3.event.scale < 3)) {
    smallScale = true;
    d3.selectAll('path').style('stroke-width', '.5px');
    console.log("Become small", d3.event.scale);
  }
}

new ResizeSensor(document.getElementById("states-div"), function() {
  width = parseInt(d3.select('#states-div').style('width')) * 1.1;
  height = width * 0.5 * 1.1;
  d3.select('#states-div').attr('height', height + "px");
  projection.scale(width).translate([width / 2.1, height / 2.3]);
  if (allExists) update(true);
});
