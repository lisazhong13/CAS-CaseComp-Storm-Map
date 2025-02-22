/*
 * StackedAreaChart - ES6 Class
 * @param  parentElement 	-- the HTML element in which to draw the visualization
 * @param  data             -- the data the that's provided initially
 * @param  displayData      -- the data that will be used finally (which might vary based on the selection)
 *
 * @param  focus            -- a switch that indicates the current mode (focus or stacked overview)
 * @param  selectedIndex    -- a global 'variable' inside the class that keeps track of the index of the selected area
 */

class StackedAreaChart {

// constructor method to initialize StackedAreaChart object
constructor(parentElement, data) {
    this.parentElement = parentElement;
    this.data = data;
    this.displayData = [];

    let colors = ['#a6cee3','#1f78b4','#b2df8a','#33a02c','#fb9a99','#e31a1c','#fdbf6f','#ff7f00','#cab2d6','#6a3d9a'];

    // grab all the keys from the key value pairs in data (filter out 'year' ) to get a list of categories
    this.dataCategories = Object.keys(this.data[0]).filter(d=>d !== "Year")

    // prepare colors for range
    let colorArray = this.dataCategories.map( (d,i) => {
        return colors[i%10]
    })

    // Set ordinal color scale
    this.colorScale = d3.scaleOrdinal()
        .domain(this.dataCategories)
        .range(colorArray);

    // Initialize filter variable
    this.filter = null;
}


	/*
	 * Method that initializes the visualization (static content, e.g. SVG area or axes)
 	*/
	initVis(){
		let vis = this;

		vis.margin = {top: 40, right: 40, bottom: 60, left: 40};

		vis.width = document.getElementById(vis.parentElement).getBoundingClientRect().width - vis.margin.left - vis.margin.right;
		vis.height = document.getElementById(vis.parentElement).getBoundingClientRect().height - vis.margin.top - vis.margin.bottom;

		// SVG drawing area
		vis.svg = d3.select("#" + vis.parentElement).append("svg")
			.attr("width", vis.width + vis.margin.left + vis.margin.right)
			.attr("height", vis.height + vis.margin.top + vis.margin.bottom)
			.append("g")
			.attr("transform", "translate(" + vis.margin.left + "," + vis.margin.top + ")");

		// Overlay with path clipping
		vis.svg.append("defs").append("clipPath")
			.attr("id", "clip")

			.append("rect")
			.attr("width", vis.width)
			.attr("height", vis.height);

		// Scales and axes
		vis.x = d3.scaleTime()
			.range([0, vis.width])
			.domain(d3.extent(vis.data, d=> d.Year));

		vis.y = d3.scaleLinear()
			.range([vis.height, 0]);

		vis.xAxis = d3.axisBottom()
			.scale(vis.x);

		vis.yAxis = d3.axisLeft()
			.scale(vis.y);

		vis.svg.append("g")
			.attr("class", "x-axis axis")
			.attr("transform", "translate(0," + vis.height + ")");

		vis.svg.append("g")
			.attr("class", "y-axis axis");

	
		// TO-DO (Activity II): Initialize stack layout
		vis.stack = d3.stack().keys(vis.dataCategories);

		// TO-DO (Activity II) Stack data
		vis.area = d3.area()
            .x(d => vis.x(d.data.Year))
            .y0(d => vis.y(d[0]))
            .y1(d => vis.y(d[1]));	

		// TO-DO (Activity II) Stacked area layout
		// vis.area = d3.area()
		vis.tooltip = vis.svg.append("text")
			.attr("class", "tooltip")
			.attr("x", 10)
			.attr("y", 20)  // Position at top left
			.style("font-size", "16px")
			.style("font-weight", "bold")
			.style("display", "none");

        // Add second area generator for single layer
        vis.singleArea = d3.area()
            .x(d => vis.x(d.data.Year))
            .y0(vis.height)
            .y1(d => vis.y(d[1] - d[0]));

        // Add title text element for category name
        vis.categoryTitle = vis.svg.append("text")
            .attr("class", "category-title")
            .attr("x", 0)
            .attr("y", -20)  // Position above the chart
            .style("font-size", "16px")
            .style("font-weight", "bold");

        vis.wrangleData();
	}

	/*
 	* Data wrangling
 	*/
	wrangleData(){
		let vis = this;
        
        // Stack the data
        vis.stackedData = vis.stack(vis.data);
        
        // Filter data if category is selected
        if (vis.filter) {
            let indexOfFilter = vis.dataCategories.findIndex(d => d === vis.filter);
            vis.displayData = [vis.stackedData[indexOfFilter]];
        } else {
            vis.displayData = vis.stackedData;
        }

		// Update the visualization
		vis.updateVis();
	}

	/*
	 * The drawing function - should use the D3 update sequence (enter, update, exit)
 	* Function parameters only needed if different kinds of updates are needed
 	*/
	updateVis(){
		let vis = this;

		// Update category title
		vis.categoryTitle.text(vis.filter || "");  // Show category name if filtered, empty if not

		// Update domain with conditional logic for filtered view
        vis.y.domain([0, d3.max(vis.displayData, function(d) {
            return d3.max(d, function(e) {
                if(vis.filter) {
                    return e[1] - e[0];  // For single layer view
                } else {
                    return e[1];  // For stacked view
                }
            });
        })]);

		// Draw the layers
		let categories = vis.svg.selectAll(".area")
			.data(vis.displayData);

		categories.enter().append("path")
			.attr("class", "area")
			.merge(categories)
			.style("fill", d => vis.colorScale(d.key))
			.style("opacity", 0.7)
			.attr("d", d => {
				if(vis.filter) {
					return vis.singleArea(d);
				} else {
					return vis.area(d);
				}
			})
			.on("mouseover", (event, d) => {
				d3.select(this).style("opacity", 1);
				vis.showTooltip(event, d);
			})
			.on("mouseout", () => {
				d3.select(this).style("opacity", 0.7);
				vis.hideTooltip();
			})
			.on("click", function(event, d) {
				vis.filter = (vis.filter === d.key) ? null : d.key;
				vis.wrangleData();
			});
	
			

		categories.exit().remove();

		// Call axis functions with the new domain
		vis.svg.select(".x-axis").call(vis.xAxis);
		vis.svg.select(".y-axis").call(vis.yAxis);
	}

	// Function to show tooltip
	showTooltip(event, d) {
		this.tooltip
			.style("display", "block")
			.attr("x", event.offsetX)  // Adjust position dynamically
			.attr("y", event.offsetY - 10)  // Slightly above cursor
			.text(d.key);
	}

	// Function to hide tooltip
	hideTooltip() {
		this.tooltip.style("display", "none");
	}
}