window.onload = setMap();

var attrArray = ["city_unmarried_m_f", "rural_unmarried_m_f", "city_baby_m_f", "rural_baby_m_f", "total_city_percent"];
var expressed = attrArray[0];

//name of each attribute to show on the map
var indicatorName = {};
indicatorName["city_unmarried_m_f"] = "Sex Ratio of Unmarried Urban Population";
indicatorName["rural_unmarried_m_f"] = "Sex Ratio of Unmarried Rural Population";
indicatorName["city_baby_m_f"] = "Sex Ratio of New-born Urban Population";
indicatorName["rural_baby_m_f"] = "Sex Ratio of New-born Ruran Population";
indicatorName["total_city_percent"] = "Percent of Urban Population";

var chartWidth = 500,
	chartHeight = 350,
    leftPadding = 30,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";//moves an element

// yscale to generate the height of each bar based on attribute value
var yScale = d3.scale.linear()
	.range([chartHeight - 10, 10])
	.domain([100, 140]);

function setMap() {
	var width = 600, height = 500;

	var map = d3.select(".mapContainer")
		.append("svg")
		.attr("class", "map")
		.attr("width", width)
		.attr("height", height);

	var projection = d3.geo.albers()
		.center([0, 36.33])
		.rotate([-103, 0, 0])
		.parallels([29.5, 45.17])
		.scale(750)
		.translate([width / 2, height / 2]);

	var path = d3.geo.path()
		.projection(projection);

	queue()
		.defer(d3.csv, "data/population.csv")
		.defer(d3.json, "data/ChinaProvinces.topojson")
		.defer(d3.json, "data/AsiaRegion_6simplified.topojson")
		.await(callback); //send data to callback function once finish loading

	function callback(error, csvData, provData, asiaData) {
		// second parameter need to inspect element and find objects
		var asiaRegion = topojson.feature(asiaData, asiaData.objects.AsiaRegion);
		var provinces = topojson.feature(provData, provData.objects.collection).features;
		// new provinces with added attributes joined
		provinces = joinData(provinces, csvData);
		setGraticule(map, path);

        map.append("path")
        	.datum(asiaRegion)
        	.attr("class", "backgroundCountry")
        	.attr("d", path);

        var colorScale = makeColorScale(csvData);
		setEnumUnits(provinces, map, path, colorScale);

		setChart(csvData, colorScale);
		createDropdown(csvData);

	};
};

function setGraticule(map, path) {
		// svg elements drawing order is determined by the order they were added to DOM
	var graticule = d3.geo.graticule()
        .step([10, 10]); //place graticule lines every 10 degrees of longitude and latitude

    var gratBackground = map.append("path")
    	.datum(graticule.outline())
    	.attr("class", "gratBackground")
    	.attr("d", path);

    // create graticule lines  
    var gratLines = map.selectAll(".gratLines") //select graticule elements that will be created
        .data(graticule.lines()) //bind graticule lines to each element to be created
        .enter() //create an element for each datum
        .append("path") //append each element to the svg as a path element
        .attr("class", "gratLines") //assign class for styling
        .attr("d", path); //project graticule lines
};

function joinData(provinces, csvData) {
	// join attributes from csv to geojson.
	for (var i = 0; i < csvData.length; i++) {
		var csvProv = csvData[i];
		var csvKey = csvProv.name;

		for (var a = 0; a < provinces.length; a++) {
			var jsonProps = provinces[a].properties;
			var jsonKey = jsonProps.name;

			if (jsonKey == csvKey) {
				attrArray.forEach(function(attr){
					var val = parseFloat(csvProv[attr]);
					jsonProps[attr] = Math.ceil(val);
				});
				jsonProps["region_code"] = csvProv["region_code"];
			};
		};
	};
	return provinces;
};

function setEnumUnits(provinces, map, path, colorScale) {
	// select all must take a list, should be a list of features, not the whole feature collection
	var enumUnits = map.selectAll(".enumUnits")
		.data(provinces)
		.enter()
		.append("path")
		.attr("class", function(d) {
			return "enumUnits " + d.properties.region_code;
		})
		.attr("d", path)
		.style("fill", function(d) {
			return choropleth(d.properties, colorScale);
		})
		.on("mouseover", function(d) {
			highlight(d.properties);
		})
		.on("mouseout", function(d) {
			dehighlight(d.properties);
		})
		.on("mousemove", moveLabel);

	var desc = enumUnits.append("desc")
		.text('{"stroke": "#000", "stroke-width": "0.5px"}');
};

function makeColorScale(data) {
	//data is an array of provinces
    var colorClasses = [
        "#fee5d9",
        "#fcae91",
        "#fb6a4a",
        "#de2d26",
        "#a50f15"
    ];

    var colorScale = d3.scale.threshold()
    	.range(colorClasses);

    //build array of all values of the expressed attribute
    var domainArray = [];
    for (var i = 0; i < data.length; i++){
        var val = parseFloat(data[i][expressed]);
        domainArray.push(val);
    };

    //cluster data using ckmeans clustering algorithm to create natural breaks
    var clusters = ss.ckmeans(domainArray, 5);
    //reset domain array to cluster minimums
    domainArray = clusters.map(function(d){
        return d3.min(d);
    });
    //remove first value from domain array to create class breakpoints
    domainArray.shift();
    //assign array of last 4 cluster minimums as domain
    colorScale.domain(domainArray);

    return colorScale; 
}

// deal with enumUnits without data
function choropleth(props, colorScale) {
    //make sure attribute value is a number
    var val = parseFloat(props[expressed]);
    //if attribute value exists, assign a color; otherwise assign gray
    if (val && val != NaN){
        return colorScale(val);
    } else {
        return "#CCC";
    };
};

function setChart(csvData, colorScale) {
	var chart = d3.select(".chartContainer")
		.append("svg")
		.attr("class", "chart")
		.attr("width", chartWidth)
		.attr("height", chartHeight);

    var chartBackground = chart.append("rect")
        .attr("class", "chartBackground")
        .attr("width", chartInnerWidth)
        .attr("height", chartInnerHeight)
        .attr("transform", translate);

	var bars = chart.selectAll(".bars")
		.data(csvData)
		.enter()
		.append("rect")
		.sort(function(a, b){
			return b[expressed] - a[expressed];
		})
		.attr("class", function(d){
			return "bars " + d.region_code;
		})
		.attr("width", chartInnerWidth / csvData.length - 1)
		.on("mouseover", highlight)
		.on("mouseout", dehighlight)
		.on("mousemove", moveLabel);

	var desc = bars.append("desc")
		.text('{"stroke": "none", "stroke-width": "0px"}');

	updateChart(bars, csvData.length, colorScale);
	updateYAxis(chart);

	var chartFrame = chart.append("rect")
		.attr("class", "chartFrame")
		.attr("width", chartInnerWidth)
		.attr("height", chartInnerHeight)
		.attr("transform", translate);
};

//update yAxis, redraw the axis based on different yScale
function updateYAxis(chart) {
	d3.select(".axis").remove();
	var yAxis = d3.svg.axis()
		.scale(yScale)
		.orient("left");

	var axis = chart.append("g")
		.attr("class", "axis")
		.attr("transform", translate)
		.call(yAxis);
}

function createDropdown(csvData) {
	var dropdown = d3.select(".dropdown")
		.on("change", function() {
			changeAttribute(this.value, csvData)
		});

	var attrOptions = dropdown.selectAll("attrOptions")
		.data(attrArray)
		.enter()
		.append("option")
		.attr("value", function(d) {return d})
		.text(function(d) {return indicatorName[d]});
};

function changeAttribute(attribute, csvData) {
	expressed = attribute;
	var colorScale = makeColorScale(csvData);

	d3.selectAll(".enumUnits")
		.transition()
		.duration(1000)
		.style("fill", function(d) {
			return choropleth(d.properties, colorScale);
		});

	var bars = d3.selectAll(".bars")
		.sort(function(a, b){
			return b[expressed] - a[expressed];
		})
		.transition()
		.delay(function(d, i) {
			return i * 20;
		});
	//change yScale, axis, and bar height
	updateYScale(expressed);
	updateYAxis(d3.select(".chart"));
	updateChart(bars, csvData.length, colorScale);
};

function updateChart(bars, length, colorScale) {
	bars.attr("x", function(d, i){
		return i * (chartInnerWidth / length) + leftPadding;
	})
	.attr("height", function(d){
		return chartInnerHeight - yScale(Math.ceil(parseFloat(d[expressed])));
	})
	.attr("y", function(d){
		return yScale(Math.ceil(parseFloat(d[expressed]))) + topBottomPadding;
	})
	.style("fill", function(d){
		return choropleth(d, colorScale);
	});

};

//update yScale based on chosen attribute
//they have different range of values, cannot use one yScale for all of them.
function updateYScale(expressed) {
	//reset to default
	yScale = d3.scale.linear()
		.range([chartHeight - 10, 10])
		.domain([100, 140]);

	if (expressed == "rural_unmarried_m_f") {
	yScale = d3.scale.linear()
		.range([chartHeight - 10, 10])
		.domain([120, 190])
	};

	if (expressed == "rural_baby_m_f") {
	yScale = d3.scale.linear()
		.range([chartHeight - 10, 10])
		.domain([90, 140])
	};

	if (expressed == "total_city_percent") {
		yScale = d3.scale.linear()
			.range([chartHeight - 10, 10])
			.domain([10, 100])
	};
};

function highlight(props) {
	//!!This selection won't work for names with multiple space
	d3.selectAll("." + props.region_code)
		.style({
			"stroke": "blue",
			"stroke-width": "2"
		});

	setLabel(props);
}

function dehighlight(props) {
	d3.selectAll("." + props.region_code)
		.style({
			"stroke": function() {
				return getStyle(this, "stroke")
			},
			"stroke-width": function() {
				return getStyle(this, "stroke-width")
			}
		});

	function getStyle(element, styleName) {
		var styleText = d3.select(element)
			.select("desc")
			.text();

		var styleObject = JSON.parse(styleText);
		return styleObject[styleName];
	};

	d3.select(".infolabel")
		.remove();
};

//set label, now is appended to body as div
function setLabel(props) {
	//different type of labels for different attributes
	var labelAttribute;
	if (!props[expressed]) {
		labelAttribute = "<h1>" + "Nodata" + "</h1><b>" + "</b>";
	} else if (expressed == "total_city_percent") {
		labelAttribute = "<h1>" + Math.ceil(props[expressed]) + "%" +
        "</h1><b>" + "</b>";
	} else {
		labelAttribute = "<h1>" + Math.ceil(props[expressed]) +
        "</h1><b>" + "</b>";
	};

    //create info label div
    var infolabel = d3.select("body")
        .append("div")
        .attr({
            "class": "infolabel",
            "id": props.region_code + "_label"
        })
        .html(labelAttribute);

    var regionName = infolabel.append("div")
        .attr("class", "labelname")
        .html(props.name);
};

//move info label with mouse
function moveLabel() {
	var labelWidth = d3.select(".infolabel")
		.node()
		.getBoundingClientRect()
		.width;
	//clientXY gives the coordinates relative to current window, will be problematic when scrolling
	//pageXY gives the coordinates relative to the whole rendered page, including hidden part after scrolling
    var x1 = d3.event.pageX + 10,
        y1 = d3.event.pageY - 75,
        x2 = d3.event.pageX - labelWidth - 10,
        y2 = d3.event.pageY + 25;

    //horizontal label coordinate, testing for overflow
    var x = d3.event.pageX > window.innerWidth - labelWidth - 20 ? x2 : x1; 
    //vertical label coordinate, testing for overflow
    var y = d3.event.pageY < 75 ? y2 : y1;

    d3.select(".infolabel")
        .style({
            "left": x + "px",
            "top": y + "px"
        });
};

