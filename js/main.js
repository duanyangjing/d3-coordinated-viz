window.onload = setMap();

function setMap() {
	var width = 960, height = 550;

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
		console.log(asia.objects);
		console.log(prov.objects);
		var asiaRegion = topojson.feature(asia, asia.objects.AsiaRegion);
		var provinces = topojson.feature(prov, prov.objects.collection).features;

		var attrArray = ["city_unmarried_m_f", "rural_unmarried_m_f", "city_baby_m_f", "rural_baby_m_f", "total_city_percent"];
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

        var backgroundCountry = map.append("path")
        	.datum(asiaRegion)
        	.attr("class", "backgroundCountry")
        	.attr("d", path);

		// select all must take a list, should be a list of features, not the whole feature collection
		var enumUnits = map.selectAll(".provinces")
			.data(provinces)
			.enter()
			.append("path")
			.attr("class", function(d) {
				return d.properties.name;
			})
			.attr("d", path);

	};
};