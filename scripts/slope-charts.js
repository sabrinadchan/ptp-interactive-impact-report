(function() {
  var data;

  var margin = { top: 20, right: 0, bottom: 20, left: 0 },
      outerWidth = 300,
      outerHeight = 190,
      width = outerWidth - margin.right - margin.left,
      height = outerHeight - margin.top - margin.bottom,
      padding = 3;

  var x = d3.scalePoint()
      .range([0, width])
      .padding(0.5);

  var y = d3.scaleLinear()
      .range([height,0]);

  var line = d3.line()
      .x((_, i) => x(i))
      .y(y);

  var tip = d3.tip()
      .attr('class', 'd3-tip')
      .offset([-10, 0])
      .html(d => `<table><tr><th colspan="3">${d.name} voters</th></tr><tr><td>canvass</td><td></td><td>phones</td></tr><tr><td>${formatPercent(d.values[0])}</td><td>→</td><td>${formatPercent(d.values[1])}</td></tr><tr><td colspan="3" class="tooltip-note">(${d3.format(".1f")((d.values[1] - d.values[0]) * 100)}pp change)</td></tr></table>`);

  const canvassStates = [
      {name: "All States", abbr: "All"},
      {name: "Colorado", abbr: "08"},
      {name: "Georgia", abbr: "13"},
      {name: "Iowa", abbr: "19"},
      {name: "Kansas", abbr: "20"},
      {name: "Kentucky", abbr: "21"},
      {name: "Maine", abbr: "23"},
      {name: "Michigan", abbr: "26"},
      {name: "Montana", abbr: "30"},
      {name: "Nebraska", abbr: "31"},
      {name: "New Hampshire", abbr: "33"},
      {name: "North Carolina", abbr: "37"},
      {name: "Pennsylvania", abbr: "42"},
      {name: "Wisconsin", abbr: "55"},
    ]

  var demographics = ["age", "sex", "race", "urbanicity"]

  var selectDemographics = d3.select("#selectDemographics");

  selectDemographics.selectAll("demographic-options")
      .data(demographics)
    .enter().append('option')
      .attr("value", d => d)
      .text(d => d.charAt(0).toUpperCase() + d.slice(1));

  const removeDemos = ["Native Am.", "Unk", "Unknown", "Uncoded", "Asian"]//, "White", "Black", "Latino"] // native-am in MT and AZ?
  Promise.all([
    d3.tsv("data/program/demographic-change.tsv"),
  ])
  .then(([demographicChanges,]) => {
    selectDemographics.on("change", update);

    function update() {
      d3.select("#slope-charts").selectAll("div.col").remove()
      var demographic = selectDemographics.property("value");

      for (var i = 0; i < canvassStates.length; i++) {
        var state = fips_to_state[canvassStates[i].abbr];
        var data = demographicChanges
            .filter(d => (d.statecode == state) && (d.demographic_type == demographic) && !removeDemos.slice(state == "MT" ? 1 : 0).includes(d.demographic_name))
        if (data.length == 0) continue;

        data = Object.assign(data.map((d,j) => ({name: d.demographic_name, values: [+d.canvassing, +d.phones], state: state, index: j})), {columns: demographicChanges.columns.slice(3)});
        var n = data.columns.length;

        x.domain(d3.range(n))
        y.domain([demographic == "sex" ? .3 : 0, demographic == "age" ? .4 : demographic == "sex" ? .7 : 1]);
        
        var svg = d3.select("#slope-charts")
          .append("div")
            .attr("class", "col col-md-6 col-lg-4 col-xl-3 justify-content-center")
          .append("svg")
            .attr("width", outerWidth)
            .attr("height", outerHeight)
          .append("g")
            .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        svg.append("rect")
            .attr("width", x(1) - x(0))
            .attr("height", height)
            .attr("fill", "#f8f8f8")
            .attr("transform", `translate(${x(0)},${0})`);

        svg.append("g")
            .attr("text-anchor", "middle")
          .selectAll("g")
          .data(data.columns)
          .join("g")
            .attr("transform", (_, i) => `translate(${x(i)},0)`)
            .call(g => g.append("text").attr("font-size", "10px").attr("dy", "-0.5em").text(d => d))
            .call(g => g.append("line").attr("y1", -3).attr("y2", 5).attr("stroke", "currentColor"));

        svg.call(tip);

        svg.append("g")
            .attr("fill", "none")
          .selectAll("path")
          .data(data)
          .join("path")
            //.attr("stroke", d => d.name == "65+" ? "red" : "black")
            .attr("stroke", d => d.values[0] > d.values[1] ? "#f62338" : "black")
            .attr("stroke-width", 1)
            .attr("d", d => line(d.values))
            .on('mouseover', function(event, d) {
              tip.show(d, this);
              d3.select(this).attr("stroke-width", 3);
              d3.selectAll(`.slope-chart-label-${d.state}-${d.index}`).attr("font-weight", "bold");
            })
            .on('mouseout', function(_, d) {
              tip.hide(d, this);
              d3.select(this).attr("stroke-width", 1);
              d3.selectAll(`.slope-chart-label-${d.state}-${d.index}`).attr("font-weight", "normal");
            });

        svg.append("g")
          .selectAll("g")
          .data(data.columns)
          .join("g")
            .attr("transform", (d, i) => `translate(${x(i) + (i === 0 ? -padding : i === n - 1 ? padding : 0)},0)`)
            .attr("text-anchor", (d, i) => i === 0 ? "end" : i === n - 1 ? "start" : "middle")
          .selectAll("text")
          .data((d, i) => d3.zip(
            data.map(i === 0 ? d => `<tspan class="${d.values[0] > d.values[1] ? "negative-slope" : "positive-slope"}">${d.name}</tspan>`
              : i === n - 1 ? d => `<tspan class="${d.values[0] > d.values[1] ? "negative-slope" : "positive-slope"}">${d.name}</tspan>`
              : d => `${formatPercent(d.values[i])}`),
            dodge(data.map(d => y(d.values[i]))),
            data.map((_,j) => j)))
          /*.data((d, i) => d3.zip(
            data.map(i === 0 ? d => `<tspan class="slope-chart">${d.name}</tspan> ${formatPercent(d.values[i])}`
              : i === n - 1 ? d => `${formatPercent(d.values[i])} <tspan class="slope-chart">${d.name}</tspan>`
              : d => `${formatPercent(d.values[i])}`),
            dodge(data.map(d => y(d.values[i])))))*/
          .join("text")
            .attr("class",([,,z]) => `slope-chart-label-${state}-${z}`)
            .attr("y", ([, y]) => y)
            .attr("dy", d => "0.35em")
            .attr("font-size", "10px")
            //.attr("fill", ([text]) => text.split(" ").includes("65+") ? "red" : "black")
            .html(([text]) => text)
            .call(halo);

        svg.append("g")
          .selectAll("g")
          .data(y.domain())
          .join("g")
            .attr("transform", d => `translate(${x(0)},${y(d)})`)
            .call(g => 
              g.append("text")
                  .attr("font-size", "10px")
                  .attr("dx", "0.2em")
                  .attr("dy", (_, i) => i ? "0.2em" : "-0.2em")
                  .attr("alignment-baseline", (_, i) => i ? "hanging" : "baseline")
                  .text(d => d3.format(".0%")(d))
                  .call(halo)
            )

        svg.append("g")
            .attr("transform", `translate(${width / 2},${height + margin.bottom / 2})`)
          .append("text")
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .text(state == "All States" ? "All States" : abbrToStateName[state]);

        /*svg.append("g")
            .attr("transform", `translate(${x(1) - x(0)},20)`)
          .append("text")
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .text("program");*/
      }
    }

    update();
  })

  function dodge(positions, separation = 10, maxiter = 10, maxerror = 1e-1) {
    positions = Array.from(positions);
    let n = positions.length;
    if (!positions.every(isFinite)) throw new Error("invalid position");
    if (!(n > 1)) return positions;
    let index = d3.range(positions.length);
    for (let iter = 0; iter < maxiter; ++iter) {
      index.sort((i, j) => d3.ascending(positions[i], positions[j]));
      let error = 0;
      for (let i = 1; i < n; ++i) {
        let delta = positions[index[i]] - positions[index[i - 1]];
        if (delta < separation) {
          delta = (separation - delta) / 2;
          error = Math.max(error, delta);
          positions[index[i - 1]] -= delta;
          positions[index[i]] += delta;
        }
      }
      if (error < maxerror) break;
    }
    return positions;
  }

  function halo(text) {
    text.clone(true)
        .each(function() { this.parentNode.insertBefore(this, this.previousSibling); })
        .attr("fill", "none")
        .attr("stroke", "white")
        .attr("stroke-width", 4)
        .attr("stroke-linejoin", "round");
  }
})();
