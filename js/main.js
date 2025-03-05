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
        document.getElementById('premium-adequacy-filter').addEventListener('change', function() {
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
            NonCatastropheLoss: +d['Non-Catastrophy Loss'].replace(/,/g, '') || 0,
            EstimatedCatastropheLoss: +d['Estimated_Catastrophe_Loss'].replace(/,/g, '') || 0,
            HurricaneLatitude: +d['Hurricane_Latitude'],
            HurricaneLongitude: +d['Hurricane_Longitude'],
            DistanceKm: +d['Distance_km'],
            PolicyYear: +d['PolicyYear'],
            AtRisk: d['AtRisk'],
            PML: +d['PML'],
            LevelOfPML: d['Level of PML'],
            PremiumAdequacy: (+d['Non-Catastrophy Loss'].replace(/,/g, '') + (+d['Estimated_Catastrophe_Loss'].replace(/,/g, '')) <= (+d['Premium'].replace(/,/g, '')) ? 'adequate' : 'inadequate')
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
        scrollWheelZoom: true
    }).setView([35.0, -50.0], 3);

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

    // Add event listeners for all filters
    document.getElementById('pml-filter').addEventListener('change', function() {
        console.log('PML filter changed to:', this.value);
        applyFilters();
    });

    document.getElementById('storm-select').addEventListener('change', function() {
        const selectedStorm = this.value;
        if (selectedStorm && stormCoordinates[selectedStorm]) {
            const { latitude, longitude } = stormCoordinates[selectedStorm];
            map.setView([latitude, longitude], 5);
        }
        applyFilters();
    });

    document.getElementById('location-select').addEventListener('change', applyFilters);
    document.getElementById('year-range').addEventListener('input', applyFilters);
    document.getElementById('premium-adequacy-filter').addEventListener('change', applyFilters);

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
    showTrajectories = false;
    applyFilters();
}

// Group to manage house markers

function addPropertyDataToMap() {
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

        const years = properties.map(p => p.PolicyYear).sort((a, b) => a - b);
        const minYear = years[0];
        const maxYear = years[years.length - 1];
        const latestYear = maxYear;

        const firstProperty = properties[0];
        if (!firstProperty.Latitude || !firstProperty.Longitude) return;

        const marker = L.marker([firstProperty.Latitude, firstProperty.Longitude], { icon: houseIcon })
            .bindPopup(createPropertyPopup(locationId, properties, minYear, maxYear, latestYear));

        marker.on('popupopen', function() {
            const slider = document.getElementById(`year-slider-${locationId}`);
            if (slider) {
                slider.addEventListener('input', function() {
                    updatePropertyInfo(locationId, properties, this.value);
                });
                // Draw initial connection
                updatePropertyInfo(locationId, properties, slider.value);
            }
        });

        marker.on('popupclose', function() {
            if (hurricaneLayer) {
                map.removeLayer(hurricaneLayer);
                hurricaneLayer = null;
            }
        });

        houseMarkers.addLayer(marker);
    });

    map.addLayer(houseMarkers);
}

function createPropertyPopup(locationId, properties, minYear, maxYear, defaultYear) {
    const currentProperty = properties.find(p => p.PolicyYear === defaultYear) || properties[0];

    const adequacyStatus = currentProperty.PremiumAdequacy === 'adequate' ? 
        '<span style="color: green;">✓ Adequate</span>' : 
        '<span style="color: red;">✗ Inadequate</span>';
    
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
                <p>Non-Catastrophe Loss: $${formatNumber(currentProperty.NonCatastropheLoss)}</p>
                <p>Estimated Catastrophe Loss: $${formatNumber(currentProperty.EstimatedCatastropheLoss)}</p>
                <p>PML: $${formatNumber(currentProperty.PML)}</p>
                <p>Premium Status: ${adequacyStatus}</p>
            </div>
        </div>
    `;
}

function updatePropertyInfo(locationId, properties, year) {
    const property = properties.find(p => p.PolicyYear === parseInt(year));
    if (!property) return;

    const adequacyStatus = property.PremiumAdequacy === 'adequate' ? 
        '<span style="color: green;">✓ Adequate</span>' : 
        '<span style="color: red;">✗ Inadequate</span>';
    
    // Update year display
    const yearDisplay = document.getElementById(`year-value-${locationId}`);
    if (yearDisplay) yearDisplay.textContent = year;

    // Update property information
    const infoDiv = document.getElementById(`property-info-${locationId}`);
    if (infoDiv) {
        infoDiv.innerHTML = `
            <p>Total Insured Value: $${formatNumber(property.TotalInsuredValue)}</p>
            <p>Premium: $${formatNumber(property.Premium)}</p>
            <p>Non-Catastrophe Loss: $${formatNumber(property.NonCatastropheLoss)}</p>
            <p>Estimated Catastrophe Loss: $${formatNumber(property.EstimatedCatastropheLoss)}</p>
            <p>PML: $${formatNumber(property.PML)}</p>
            <p>Premium Status: ${adequacyStatus}</p>
        `;
    }

    // Draw hurricane connection
    drawHurricaneConnection(property);
}

// Hurricane visualization layer
let hurricaneLayer = null;

function drawHurricaneConnection(property) {
    // Clear previous layer
    if (hurricaneLayer) {
        map.removeLayer(hurricaneLayer);
    }

    // Create new layer
    hurricaneLayer = new L.FeatureGroup();

    // Add line connecting property to hurricane
    const propertyCoords = [property.Latitude, property.Longitude];
    const hurricaneCoords = [property.HurricaneLatitude, property.HurricaneLongitude];
    
    if (!isNaN(hurricaneCoords[0]) && !isNaN(hurricaneCoords[1])) {
        const connectionLine = L.polyline([propertyCoords, hurricaneCoords], {
            color: 'red',
            weight: 2,
            dashArray: '5,5'
        }).addTo(hurricaneLayer);

        // Add hurricane marker
        const hurricaneIcon = L.icon({
            iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            iconSize: [25, 41],
            iconAnchor: [12, 41]
        });

        const hurricaneMarker = L.marker(hurricaneCoords, { icon: hurricaneIcon })
            .bindPopup(`Hurricane Location<br>Distance: ${property.DistanceKm} km`)
            .addTo(hurricaneLayer);

        map.addLayer(hurricaneLayer);
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
    
    // Create unique combinations of storm name and year
    const stormNameYears = [...new Set(data.map(d => `${d.storm_name}_${d.year}`))];
    console.log('Unique storm name-year combinations:', stormNameYears);

    // Clear existing options except "All Storms"
    stormSelect.innerHTML = '<option value="all_storm" selected>All Storms</option>';

    stormNameYears.forEach(nameYear => {
        const [name, year] = nameYear.split('_');
        const option = document.createElement('option');
        option.value = nameYear; // Use combined name_year as value
        option.textContent = `${name} (${year})`;
        stormSelect.appendChild(option);
        
        // Store the coordinates for each storm by name and year
        const stormData = data.filter(d => d.storm_name === name && d.year === parseInt(year));
        if (stormData.length > 0) {
            stormCoordinates[nameYear] = {
                latitude: stormData[0].latitude,
                longitude: stormData[0].longitude
            };
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

function getPMLLevel(pmlValue) {
    if (pmlValue >= 250000) {
        return 'high';
    } else if (pmlValue >= 100000) {
        return 'medium';
    } else {
        return 'low';
    }
}

function applyFilters(latMin = null, latMax = null, lngMin = null, lngMax = null) {
    const selectedStormValue = document.getElementById('storm-select').value;
    const pastYears = parseInt(document.getElementById('year-range').value);
    const selectedLocation = document.getElementById('location-select').value;
    const currentYear = new Date().getFullYear();
    const selectedStormYear = parseInt(document.getElementById('storm-year-slider').value);
    const startYear = currentYear - pastYears;
    const adequacyFilter = document.getElementById('premium-adequacy-filter').value;
    const pmlFilter = document.getElementById('pml-filter').value;

    console.log('Applying filters with PML filter:', pmlFilter);

    // Flatten propertyData for filtering
    const allProperties = Object.entries(propertyData).flatMap(([locationId, properties]) =>
        properties.map(property => ({ ...property, Location: locationId }))
    );

    console.log('Sample PML values:', allProperties.slice(0, 5).map(p => p.PML));

    const filteredPropertyData = allProperties.filter(property => {
        const isLocationSelected = (selectedLocation === "all" || property.Location === selectedLocation);
        const isLatValid = (!latMin || property.Latitude >= latMin) && (!latMax || property.Latitude <= latMax);
        const isLngValid = (!lngMin || property.Longitude >= lngMin) && (!lngMax || property.Longitude <= lngMax);
        const isAdequacyMatch = (adequacyFilter === "all" || property.PremiumAdequacy === adequacyFilter);
        
        // PML filtering
        const propertyPMLLevel = getPMLLevel(property.PML);
        const isPMLMatch = pmlFilter === "all" || propertyPMLLevel === pmlFilter;
        
        if (!isPMLMatch) {
            console.log('Property filtered out - PML:', property.PML, 'Level:', propertyPMLLevel, 'Filter:', pmlFilter);
        }

        return isLocationSelected && isLatValid && isLngValid && isAdequacyMatch && isPMLMatch;
    });

    console.log('Properties after filtering:', filteredPropertyData.length);

    d3.csv("data/StormData.csv").then(csvData => {
        const stormData = parseStormCSV(csvData);
        const filteredStormData = stormData.filter(row => {
            let isStormSelected;
            if (selectedStormValue === "all_storm") {
                isStormSelected = true;
            } else {
                const [selectedName, selectedYear] = selectedStormValue.split('_');
                isStormSelected = row.storm_name === selectedName && row.year === parseInt(selectedYear);
            }
            
            const isYearValid = (pastYears === 0 || (row.year >= startYear && row.year <= currentYear));
            const isLatValid = (!latMin || row.latitude >= latMin) && (!latMax || row.latitude <= latMax);
            const isLngValid = (!lngMin || row.longitude >= lngMin) && (!lngMax || row.longitude <= lngMax);
            return isStormSelected && isYearValid && isLatValid && isLngValid;
        });

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

    // Keep the base tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Group storm data by name and year
    const stormGroups = {};
    stormData.forEach(point => {
        const key = `${point.storm_name}_${point.year}`;
        if (!stormGroups[key]) {
            stormGroups[key] = [];
        }
        stormGroups[key].push(point);
    });

    // Process each storm group separately
    Object.entries(stormGroups).forEach(([key, points]) => {
        // Sort points by some criteria (you might want to add a timestamp field in your data)
        points.sort((a, b) => {
            // If you have a more specific ordering criteria, use it here
            return a.distance_to_land - b.distance_to_land;
        });

        const lineCoordinates = [];

        // Add circles and prepare line coordinates for this storm
        points.forEach(point => {
            const category = getStormCategory(point.wind_speed);
            let color = getStormColor(category);

            const circle = L.circleMarker([point.latitude, point.longitude], {
                radius: point.wind_speed * 0.1,
                color: color,
                fillOpacity: 0.8
            }).bindPopup(`Storm: ${point.storm_name}<br>
                         Year: ${point.year}<br>
                         Wind Speed: ${point.wind_speed} knots<br>
                         Nature: ${translateNature(point.nature)}<br>
                         Distance to Land: ${point.distance_to_land} km`)
            .addTo(map);

            lineCoordinates.push([point.latitude, point.longitude]);
        });

        // Draw trajectory for this storm group if enabled
        if (showTrajectories && lineCoordinates.length > 1) {
            // Use different colors for different years
            const trajectoryColor = getRandomColor();
            L.polyline(lineCoordinates, { 
                color: trajectoryColor,
                weight: 2,
                opacity: 0.6
            }).addTo(map);
        }
    });
}

function getStormColor(category) {
    const colorMap = {
        'Depression': '#ffffcc',
        'Tropical Storm': '#ffcc00',
        'Category 1': '#ff9900',
        'Category 2': '#ff6600',
        'Category 3': '#ff3300',
        'Category 4': '#cc0000',
        'Category 5': '#990000'
    };
    return colorMap[category] || 'gray';
}

function getRandomColor() {
    const colors = [
        '#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd',
        '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
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