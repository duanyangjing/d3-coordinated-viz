window.onload = setMap();

function setMap() {
	queue()
		.defer(d3.csv, "data/population.csv")
		.defer(d3.json, "data/ChinaProvinces.topojson")
		.await(callback); //send data to callback function once finish loading

	function callback(error, pop, prov) {
		console.log(prov);
		// second parameter need to inspect element and find objects
		var provinces = topojson.feature(prov, prov.objects.China_provinces)

		console.log(provinces);
	};
};