window.onload = setMap();

var attrArray = ["city_unmarried_m_f", "rural_unmarried_m_f", "city_baby_m_f", "rural_baby_m_f", "total_city_percent"];
var expressed = attrArray[2];

var chartWidth = window.innerWidth * 0.425,
	chartHeight = 550,
    leftPadding = 30,
    rightPadding = 2,
    topBottomPadding = 5,
    chartInnerWidth = chartWidth - leftPadding - rightPadding,
    chartInnerHeight = chartHeight - topBottomPadding * 2,
    translate = "translate(" + leftPadding + "," + topBottomPadding + ")";

// yscale to generate the height of each bar based on attribute value
var yScale = d3.scale.linear()
	.range([chartHeight - 10, 50])
	.domain([100, 180])

function setMap() {
	var width = window.innerWidth * 0.5, height = 550;

	var map = d3.select("body")
		.append("svg")
		.attr("class", "map")
		.attr("width", width)
		.attr("height", height);

	var projection = d3.geo.albers()
		.center([0, 36.33])
		.rotate([-104.45, 0, 0])
		.parallels([29.5, 45.17])
		.scale(850)
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

        var backgroundCountry = map.append("path")
        	.datum(asiaRegion)
        	.attr("class", "backgroundCountry")
        	.attr("d", path);

        var colorScale = makeColorScale(csvData);
		
		setEnumUnits(provinces, map, path, colorScale);

		setChart(csvData, colorScale);
		createDropdown(csvData);
		console.log(csvData);

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
				})
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
	console.log("From function makeColorScale:");
	console.log("expressed attribute: " + expressed);
	console.log(data);
    var colorClasses = [
        "#D4B9DA",
        "#C994C7",
        "#DF65B0",
        "#DD1C77",
        "#980043"
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
	var chart = d3.select("body")
		.append("svg")
		.attr("width", chartWidth)
		.attr("height", chartHeight)
		.attr("class", "chart");

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

	var chartTitle = chart.append("text")
		.attr("x", 40)
		.attr("y", 40)
		.attr("class", "chartTitle")
		.text(expressed);

	var yAxis = d3.svg.axis()
		.scale(yScale)
		.orient("left");

	var axis = chart.append("g")
		.attr("class", "axis")
		.attr("transform", translate)
		.call(yAxis);

	var chartFrame = chart.append("rect")
		.attr("class", "chartFrame")
		.attr("width", chartInnerWidth)
		.attr("height", chartInnerHeight)
		.attr("transform", translate);
};

function createDropdown(csvData) {
	var dropdown = d3.select("body")
		.append("select")
		.attr("class", "dropdown")
		.on("change", function() {
			changeAttribute(this.value, csvData)
		});
	// The initial option in the dropdown menu 
	var titleOption = dropdown.append("option")
		.attr("selected", "true")//this will set the default option in dropdown
		.attr("disabled", "true")
		.text("Select Attribute");
	// Options about attributes to select in the dropdown menu
	var attrOptions = dropdown.selectAll("attrOptions")
		.data(attrArray)
		.enter()
		.append("option")
		.attr("value", function(d) {return d})
		.text(function(d) {return d});
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

	updateChart(bars, csvData.length, colorScale);
};

function updateChart(bars, length, colorScale) {
	bars.attr("x", function(d, i){
		return i * (chartInnerWidth / length) + leftPadding;
	})
	.attr("height", function(d){
		return chartInnerHeight - (parseFloat(d[expressed]));
	})
	.attr("y", function(d){
		return yScale(parseFloat(d[expressed])) + topBottomPadding;
	})
	.style("fill", function(d){
		return choropleth(d, colorScale);
	});

	d3.select(".chartTitle")
		.text(expressed);
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
    var labelAttribute = "<h1>" + props[expressed] +
        "</h1><b>" + expressed + "</b>";

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
    var x = d3.event.clientX + 10,
        y = d3.event.clientY - 75;

    d3.select(".infolabel")
        .style({
            "left": x + "px",
            "top": y + "px"
        });
}

