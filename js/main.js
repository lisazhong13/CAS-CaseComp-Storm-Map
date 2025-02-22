let areachart, timeline;
let map; // Ensure map is defined globally
let stormCoordinates = {}; // Object to store storm coordinates
let propertyData = []; // Array to store property data

loadData();

function loadData() {
    Promise.all([
        d3.csv("data/StormData.csv"),
        d3.csv("data/PropertyData.csv")
    ]).then(([stormCsvData, propertyCsvData]) => {
        console.log('Storm data loaded:', stormCsvData);
        console.log('Property data loaded:', propertyCsvData);

        const stormData = parseStormCSV(stormCsvData);
        propertyData = parsePropertyCSV(propertyCsvData);

        console.log('Parsed property data:', propertyData);

        locationAreas = generateLocationAreas(propertyData);
        console.log('Generated locationAreas:', locationAreas);

        initializeMap();
        populateStormDropdown(stormData);
		// Add event listener for year-range input
        document.getElementById('year-range').addEventListener('input', function() {
            console.log('Year range changed:', this.value); // Debugging
            applyFilters();
        });
        populateLocationDropdown();
        applyFilters();
    }).catch(error => console.error('Error loading CSV:', error));
}


function parseStormCSV(data) {
    return data.map(d => ({
        storm_name: d['storm_name'],
        latitude: +d['latitude'],
        longitude: +d['longitude'],
        wind_speed: +d['wind_speed'],
        distance_to_land: +d['distance_to_land'],
        nature: d['nature'],
        impactful: d['Impactful'],
        year: +d['year']
    }));
}

function parsePropertyCSV(data) {
    const locations = {};

    data.forEach(d => {
        const locationId = d['Location'];
        const lat = +d['Latitude'];
        const lng = +d['Longitude'];

        if (!locationId || isNaN(lat) || isNaN(lng)) {
            console.warn('Skipping invalid property entry:', d);
            return;
        }

        if (!locations[locationId]) {
            locations[locationId] = [];
        }

        locations[locationId].push({
            Latitude: lat,
            Longitude: lng,
            TotalInsuredValue: +d['Total Insured Value'].replace(/,/g, ''),
            Premium: +d['Premium'].replace(/,/g, ''),
            PolicyYear: +d['PolicyYear'],
            AtRisk: d['AtRisk'],
            PML: +d['PML'],
            LevelOfPML: d['Level of PML']
        });
    });

    return locations;
}

function generateLocationAreas(locationData) {
    const locationAreas = {};

    Object.keys(locationData).forEach(locationId => {
        const coordinates = locationData[locationId]
            .filter(coord => coord.Latitude && coord.Longitude)
            .map(coord => [coord.Latitude, coord.Longitude]);

        if (coordinates.length > 0) {
            locationAreas[locationId] = {
                type: 'polygon',
                coordinates: coordinates,
                color: getColorForLocation(locationId),
                fillOpacity: 0.2
            };
        } else {
            console.warn(`No valid coordinates for location ID: ${locationId}`);
        }
    });

    return locationAreas;
}


// Example function to assign colors based on location ID
function getColorForLocation(locationId) {
    const colors = ['blue', 'red', 'green', 'purple', 'orange', 'yellow', 'cyan', 'magenta', 'lime', 'pink'];
    return colors[locationId % colors.length]; // Cycle through colors
}

function drawLocationAreas() {
    for (const locationId in locationAreas) {
        const area = locationAreas[locationId];

        if (area.type === 'polygon') {
            // Draw a polygon
            const polygon = L.polygon(area.coordinates, {
                color: area.color,
                fillOpacity: area.fillOpacity
            }).bindPopup(`Location ${locationId}`).addTo(map);
            polygon.locationId = locationId; // Add a unique identifier
        } else if (area.type === 'circle') {
            // Draw a circle (if needed)
            const circle = L.circle(area.center, {
                radius: area.radius,
                color: area.color,
                fillOpacity: area.fillOpacity
            }).bindPopup(`Location ${locationId}`).addTo(map);
            circle.locationId = locationId; // Add a unique identifier
        }
    }
}

let houseMarkers = new L.FeatureGroup(); 

function addPropertyMarkersToMap() {
    // 清除现有 marker 组（防止重复添加）
    houseMarkers.clearLayers();
    
    const houseIcon = L.icon({
        iconUrl: 'img/house.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    Object.keys(propertyData).forEach(locationId => {
        const properties = propertyData[locationId];
        if (!properties.length) return;

        const { Latitude, Longitude } = properties[0];
        const marker = L.marker([Latitude, Longitude], { icon: houseIcon });
        marker.locationId = locationId;

        marker.bindPopup(createLocationPopup(locationId, properties));

        marker.on('popupopen', function() {
            const slider = document.getElementById('slider-location-' + locationId);
            if (slider) {
                slider.addEventListener('input', function() {
                    const year = +this.value;
                    updateLocationPopup(locationId, year);
                });
            }
        });

        houseMarkers.addLayer(marker);
    });

    map.addLayer(houseMarkers);
}

function createLocationPopup(locationId, properties) {
    const years = properties.map(p => p.PolicyYear).sort((a, b) => a - b);
    const minYear = years[0];
    const maxYear = years[years.length - 1];
    const defaultYear = maxYear;
    const property = properties.find(p => p.PolicyYear === defaultYear) || properties[0];
    
    return `
        <div>
            <h4>Location ${locationId}</h4>
            <label for="slider-location-${locationId}">
              Year: <span id="year-display-${locationId}">${defaultYear}</span>
            </label>
            <input type="range" id="slider-location-${locationId}" min="${minYear}" max="${maxYear}" value="${defaultYear}" step="1">
            <div id="info-location-${locationId}">
                <p>Total Insured Value: ${property.TotalInsuredValue}</p>
                <p>Premium: ${property.Premium}</p>
                <p>PML: ${property.PML}</p>
            </div>
        </div>
    `;
}

function updateLocationPopup(locationId, selectedYear) {
    const properties = propertyData[locationId];
    const property = properties.find(p => p.PolicyYear === selectedYear);
    if (property) {
        document.getElementById('year-display-' + locationId).textContent = selectedYear;
        const infoDiv = document.getElementById('info-location-' + locationId);
        infoDiv.innerHTML = `
            <p>Total Insured Value: ${property.TotalInsuredValue}</p>
            <p>Premium: ${property.Premium}</p>
            <p>PML: ${property.PML}</p>
        `;
    }
}

function initializeMap() {
    // Initialize the map
    map = L.map('map', {
        scrollWheelZoom: true // Enable scroll wheel zoom
    }).setView([35.0, -50.0], 3); // Set initial view to a larger area

    // Add tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Draw shaded areas for Locations
    drawLocationAreas();

    // Add property data to the map
    addPropertyDataToMap();

	addPropertyMarkersToMap();

    // Initialize drawing tools
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
        draw: {
            polyline: false,
            circle: false,
            marker: false,
            rectangle: true,
            polygon: true
        },
        edit: {
            featureGroup: drawnItems
        }
    });
    map.addControl(drawControl);

    // Handle drawing creation
    map.on(L.Draw.Event.CREATED, function (event) {
        const layer = event.layer;
        drawnItems.addLayer(layer);

        if (typeof layer.getBounds === 'function') {
            const bounds = layer.getBounds();
            const latMin = bounds.getSouth();
            const latMax = bounds.getNorth();
            const lngMin = bounds.getWest();
            const lngMax = bounds.getEast();

            applyFilters(latMin, latMax, lngMin, lngMax);
        } else {
            console.warn('Layer does not support getBounds:', layer);
        }
    });

    // Ensure trajectories are not shown initially
    showTrajectories = false; // Set to false initially
    applyFilters(); // Update the map based on the current filters
}

// Group to manage house markers

function addPropertyDataToMap() {
    // Clear existing markers to avoid duplicates
    houseMarkers.clearLayers();

    const houseIcon = L.icon({
        iconUrl: 'img/house.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    Object.keys(propertyData).forEach(locationId => {
        const properties = propertyData[locationId];
        if (!Array.isArray(properties)) return;

        // Get all years for this location
        const years = properties.map(p => p.PolicyYear).sort((a, b) => a - b);
        const minYear = years[0];
        const maxYear = years[years.length - 1];
        const latestYear = maxYear;

        // Use the first property's location for the marker
        const firstProperty = properties[0];
        if (!firstProperty.Latitude || !firstProperty.Longitude) return;

        // Create marker with house icon and dynamic popup content
        const marker = L.marker([firstProperty.Latitude, firstProperty.Longitude], { icon: houseIcon })
            .bindPopup(createPropertyPopup(locationId, properties, minYear, maxYear, latestYear));

        // Add event listener when popup opens
        marker.on('popupopen', function() {
            const slider = document.getElementById(`year-slider-${locationId}`);
            if (slider) {
                slider.addEventListener('input', function() {
                    updatePropertyInfo(locationId, properties, this.value);
                });
            }
        });

        houseMarkers.addLayer(marker);
    });

    map.addLayer(houseMarkers);
}

function createPropertyPopup(locationId, properties, minYear, maxYear, defaultYear) {
    const currentProperty = properties.find(p => p.PolicyYear === defaultYear) || properties[0];
    
    return `
        <div class="property-popup">
            <h4>Location ${locationId}</h4>
            <div class="year-slider">
                <label>Year: <span id="year-value-${locationId}">${defaultYear}</span></label>
                <input type="range" 
                    id="year-slider-${locationId}" 
                    min="${minYear}" 
                    max="${maxYear}" 
                    value="${defaultYear}"
                    step="1">
            </div>
            <div id="property-info-${locationId}" class="property-info">
                <p>Total Insured Value: $${formatNumber(currentProperty.TotalInsuredValue)}</p>
                <p>Premium: $${formatNumber(currentProperty.Premium)}</p>
                <p>PML: $${formatNumber(currentProperty.PML)}</p>
            </div>
        </div>
    `;
}

function updatePropertyInfo(locationId, properties, year) {
    const property = properties.find(p => p.PolicyYear === parseInt(year));
    if (!property) return;

    // Update year display
    const yearDisplay = document.getElementById(`year-value-${locationId}`);
    if (yearDisplay) yearDisplay.textContent = year;

    // Update property information
    const infoDiv = document.getElementById(`property-info-${locationId}`);
    if (infoDiv) {
        infoDiv.innerHTML = `
            <p>Total Insured Value: $${formatNumber(property.TotalInsuredValue)}</p>
            <p>Premium: $${formatNumber(property.Premium)}</p>
            <p>PML: $${formatNumber(property.PML)}</p>
        `;
    }
}

function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function updatePropertyMap(filteredPropertyData) {
    // Clear only house markers
    houseMarkers.clearLayers();

    const houseIcon = L.icon({
        iconUrl: 'img/house.png',
        iconSize: [30, 30],
        iconAnchor: [15, 30],
        popupAnchor: [0, -30]
    });

    // Group filtered data by location
    const groupedData = {};
    filteredPropertyData.forEach(property => {
        if (!groupedData[property.Location]) {
            groupedData[property.Location] = [];
        }
        groupedData[property.Location].push(property);
    });

    // Add filtered data
    Object.entries(groupedData).forEach(([locationId, properties]) => {
        const firstProperty = properties[0];
        const years = properties.map(p => p.PolicyYear).sort((a, b) => a - b);
        const minYear = years[0];
        const maxYear = years[years.length - 1];

        const marker = L.marker([firstProperty.Latitude, firstProperty.Longitude], { icon: houseIcon })
            .bindPopup(createPropertyPopup(locationId, properties, minYear, maxYear, maxYear));

        marker.on('popupopen', function() {
            const slider = document.getElementById(`year-slider-${locationId}`);
            if (slider) {
                slider.addEventListener('input', function() {
                    updatePropertyInfo(locationId, properties, this.value);
                });
            }
        });

        houseMarkers.addLayer(marker);
    });

    map.addLayer(houseMarkers);
}

function getColorForPML(level) {
    switch (level) {
        case 'High':
            return '#4A90E2'; // Darker blue for high risk
        case 'Medium':
            return '#7FB3F7'; // Medium blue for medium risk
        case 'Low':
            return '#B3D9FF'; // Light blue for low risk
        default:
            return '#E6F2FF'; // Very light blue for unknown risk
    }
}

function populateStormDropdown(data) {
    const stormSelect = document.getElementById('storm-select');
    const impactfulSelect = document.getElementById('impactful-select');
    
    const stormNames = [...new Set(data.map(d => d.storm_name))];
    console.log('Unique storm names:', stormNames);

    stormNames.forEach(name => {
        const option = document.createElement('option');
        option.value = name;
        option.textContent = name;
        stormSelect.appendChild(option);
        
        // Store the coordinates for each storm
        const stormData = data.filter(d => d.storm_name === name);
        if (stormData.length > 0) {
            stormCoordinates[name] = {
                latitude: stormData[0].latitude,
                longitude: stormData[0].longitude
            };
        }
    });

    // Populate impactful options
    const impactfulValues = [...new Set(data.map(d => d.impactful))];
    impactfulValues.forEach(value => {
        if (value && value.trim() !== "") {
            const option = document.createElement('option');
            option.value = value;
            option.textContent = value;
            impactfulSelect.appendChild(option);
        }
    });

    // Add event listeners
    stormSelect.addEventListener('change', function() {
        const selectedStorm = this.value;
        if (selectedStorm && stormCoordinates[selectedStorm]) {
            const { latitude, longitude } = stormCoordinates[selectedStorm];
            map.setView([latitude, longitude], 5);
        }
        applyFilters();
    });

    impactfulSelect.addEventListener('change', function() {
        applyFilters();
    });
}

function populateLocationDropdown() {
    const locationSelect = document.getElementById('location-select');
    locationSelect.innerHTML = '<option value="all" selected>All Locations</option>';

    // Get unique location IDs from propertyData
    const locationIds = Object.keys(propertyData);

    locationIds.forEach(location => {
        const option = document.createElement('option');
        option.value = location;
        option.textContent = `Location ${location}`;
        locationSelect.appendChild(option);
    });

    locationSelect.addEventListener('change', function() {
        applyFilters();
    });

    console.log('Location dropdown populated:', locationIds);
}


function applyFilters(latMin = null, latMax = null, lngMin = null, lngMax = null) {
    const selectedStorm = document.getElementById('storm-select').value;
    const pastYears = parseInt(document.getElementById('year-range').value);
    const impactfulFilter = document.getElementById('impactful-select').value;
    const selectedLocation = document.getElementById('location-select').value;
    const currentYear = new Date().getFullYear();
	const selectedStormYear = parseInt(document.getElementById('storm-year-slider').value);
    const startYear = currentYear - pastYears; // Calculate the start year
	console.log('pastYears:', pastYears); // Debugging
    console.log('startYear:', startYear); // Debugging
    console.log('currentYear:', currentYear); // Debugging

    // Flatten propertyData for filtering
    const allProperties = Object.entries(propertyData).flatMap(([locationId, properties]) =>
        properties.map(property => ({ ...property, Location: locationId }))
    );

    const filteredPropertyData = allProperties.filter(property => {
        const isLocationSelected = (selectedLocation === "all" || property.Location === selectedLocation);
        const isLatValid = (!latMin || property.Latitude >= latMin) && (!latMax || property.Latitude <= latMax);
        const isLngValid = (!lngMin || property.Longitude >= lngMin) && (!lngMax || property.Longitude <= lngMax);
        return isLocationSelected && isLatValid && isLngValid;
    });

    d3.csv("data/StormData.csv").then(csvData => {
        const stormData = parseStormCSV(csvData);
        const filteredStormData = stormData.filter(row => {
            const isStormSelected = (selectedStorm === "all_storm" || row.storm_name === selectedStorm);
            const isYearValid = (pastYears === 0 || (row.year >= startYear && row.year <= currentYear)); // Corrected year comparison
            const isLatValid = (!latMin || row.latitude >= latMin) && (!latMax || row.latitude <= latMax);
            const isLngValid = (!lngMin || row.longitude >= lngMin) && (!lngMax || row.longitude <= lngMax);
            const isImpactfulValid = (impactfulFilter === "all" || row.impactful === impactfulFilter);
            return isStormSelected && isYearValid && isLatValid && isLngValid && isImpactfulValid;
        });

        // Update both storm and property layers
        updateMap(filteredStormData);
        updatePropertyMap(filteredPropertyData);
    });
}

function getStormCategory(windSpeed) {
    if (windSpeed < 39) return 'Depression';
    if (windSpeed < 74) return 'Tropical Storm';
    if (windSpeed < 96) return 'Category 1';
    if (windSpeed < 111) return 'Category 2';
    if (windSpeed < 130) return 'Category 3';
    if (windSpeed < 157) return 'Category 4';
    return 'Category 5';
}

// Global variable to store the toggle state
let showTrajectories = true;

// Event listener for the "Show Trajectories" toggle
document.getElementById('toggle-trajectories').addEventListener('change', function() {
    showTrajectories = this.checked;
    applyFilters();
});

function updateMap(stormData) {
    if (!map) {
        console.error('Map is not initialized.');
        return;
    }

    // Clear existing layers
    map.eachLayer(layer => {
        if (layer instanceof L.Polyline || layer instanceof L.CircleMarker) {
            map.removeLayer(layer);
        }
    });

    // Sort storm data by year
    stormData.sort((a, b) => a.year - b.year);

    // Create an array to hold the coordinates for the line
    const lineCoordinates = [];

    // Add circles and prepare line coordinates
    stormData.forEach(point => {
        const category = getStormCategory(point.wind_speed);
        let color;

        // Set color based on storm category
        switch (category) {
            case 'Depression':
                color = '#ffffcc'; // Light yellow
                break;
            case 'Tropical Storm':
                color = '#ffcc00'; // Yellow
                break;
            case 'Category 1':
                color = '#ff9900'; // Orange
                break;
            case 'Category 2':
                color = '#ff6600'; // Dark Orange
                break;
            case 'Category 3':
                color = '#ff3300'; // Red
                break;
            case 'Category 4':
                color = '#cc0000'; // Dark Red
                break;
            case 'Category 5':
                color = '#990000'; // Maroon
                break;
            default:
                color = 'gray'; // Default color
        }

        const circle = L.circleMarker([point.latitude, point.longitude], {
            radius: point.wind_speed * 0.1, // Adjust size based on wind speed
            color: color,
            fillOpacity: 0.8
        }).bindPopup(`Storm: ${point.storm_name}<br>
                      Wind Speed: ${point.wind_speed} knots<br>
                      Year: ${point.year}<br>
                      Nature: ${translateNature(point.nature)}<br>
                      Distance to Land: ${point.distance_to_land} km`)
        .addTo(map);

        // Add the point to the line coordinates
        lineCoordinates.push([point.latitude, point.longitude]);
    });

    // Draw a polyline connecting the circles (if trajectories are enabled)
    if (showTrajectories && lineCoordinates.length > 1) {
        L.polyline(lineCoordinates, { color: 'blue' }).addTo(map);
    }
}

function translateNature(natureCode) {
    const natureMap = {
        'DS': 'Disturbance',
        'TS': 'Tropical',
        'ET': 'Extratropical',
        'SS': 'Subtropical',
        'NR': 'Not reported',
        'MX': 'Mixture'
    };
    return natureMap[natureCode] || natureCode; // Return the translated value or the original if not found
}