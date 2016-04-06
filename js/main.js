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
		// TODO: Try see if the original shapefile is projected
		.defer(d3.json, "data/ChinaProvinces.topojson")
		.defer(d3.json, "data/AsiaRegion_6simplified.topojson")
		.await(callback); //send data to callback function once finish loading

	function callback(error, pop, prov, asia) {
		// second parameter need to inspect element and find objects
		var asiaRegion = topojson.feature(asia, asia.objects.AsiaRegion);
		var provinces = topojson.feature(prov, prov.objects.collection).features;
		// new provinces with added attributes joined
		provinces = joinData(provinces, pop);
		setGraticule(map, path);

        var backgroundCountry = map.append("path")
        	.datum(asiaRegion)
        	.attr("class", "backgroundCountry")
        	.attr("d", path);

        var colorScale = makeColorScale(pop);
		
		setEnumUnits(provinces, map, path, colorScale);

		setChart(pop, colorScale);
		createDropdown(pop);

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

function joinData(provinces, pop) {
	// join attributes from csv to geojson.
	for (var i = 0; i < pop.length; i++) {
		var csvProv = pop[i];
		var csvKey = csvProv.name;

		for (var a = 0; a < provinces.length; a++) {
			var jsonProps = provinces[a].properties;
			var jsonKey = jsonProps.name;

			if (jsonKey == csvKey) {
				attrArray.forEach(function(attr){
					var val = parseFloat(csvProv[attr]);
					jsonProps[attr] = val;
				})
			};
		};
	};

	return provinces;
};

function setEnumUnits(provinces, map, path, colorScale) {
		// select all must take a list, should be a list of features, not the whole feature collection
	var enumUnits = map.selectAll(".provinces")
		.data(provinces)
		.enter()
		.append("path")
		.attr("class", "enumUnits")
		.attr("id", function(d) {
			return d.properties.name;
		})
		.attr("d", path)
		.style("fill", function(d){
			return choropleth(d.properties, colorScale);
		});
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

function setChart(pop, colorScale) {
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

	var bars = chart.selectAll(".bar")
		.data(pop)
		.enter()
		.append("rect")
		.sort(function(a, b){
			return a[expressed] - b[expressed];
		})
		.attr("class", function(d){
			return "bar " + d.name;
		})
		.attr("width", chartInnerWidth / pop.length - 1);

		updateChart(bars, pop.length, colorScale);
		//addNumbersToChart(chart, pop, chartWidth, chartHeight, yScale);

	var chartTitle = chart.append("text")
		.attr("x", 40)
		.attr("y", 40)
		.attr("class", "chartTitle")
		.text("Sex-ratio of new-born population in cities");

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

function addNumbersToChart(chart, pop, chartWidth, chartHeight, yScale) {
	// annotate each bar in the chart
	var numbers = chart.selectAll(".numbers")
		.data(pop)
		.enter()
		.append("text")
		.sort(function(a, b){
			return a[expressed] - b[expressed];
		})
		.attr("class", function(d){
			return "numbers " + d.name;
		})
		.attr("text-anchor", "middle")
		.attr("x", function(d, i){
			var fraction = chartWidth / pop.length;
			return i * fraction + (fraction - 1) / 2;
		})
		.attr("y", function(d){
			return chartHeight - yScale(parseFloat(d[expressed])) + 15;
		})
		.text(function(d){
			return d[expressed];
		});
}

function createDropdown(pop) {
	var dropdown = d3.select("body")
		.append("select")
		.attr("class", "dropdown")
		.on("change", function() {
			changeAttribute(this.value, pop)
		});
	// The initial option in the dropdown menu 
	var titleOption = dropdown.append("option")
		.attr("class", "titleOption")
		.attr("disabled", "true")
		.text("Select Attribute");
	// Options about attributes to select in the dropdown menu
	var attrOptions = dropdown.selectAll("attrOptions")
		.data(attrArray)
		.enter()
		.append("option")
		.attr("value", function(d) {return d})
		.text(function(d) {return d});
}

function changeAttribute(attribute, pop) {
	expressed = attribute;
	var colorScale = makeColorScale(pop);

	d3.selectAll(".enumUnits")
		.style("fill", function(d) {
			return choropleth(d.properties, colorScale)
		});

	var bars = d3.selectAll(".bar")
		.sort(function(a, b){
			return a[expressed] - b[expressed];
		});

	updateChart(bars, pop.length, colorScale);
}

function updateChart(bars, length, colorScale) {
	bars.attr("x", function(d, i){
		return i * (chartInnerWidth / length) + leftPadding;
	})
	.attr("height", function(d){
		return yScale(parseFloat(d[expressed]));
	})
	.attr("y", function(d){
		return chartHeight - yScale(parseFloat(d[expressed])) - topBottomPadding;
	})
	.style("fill", function(d){
		return choropleth(d, colorScale);
	});

	d3.select(".chartTitle")
		.text(expressed);
}