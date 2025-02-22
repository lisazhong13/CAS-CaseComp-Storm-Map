# 🌪️ Storm Trajectory Map

Welcome to the **Storm Trajectory Map** project! This interactive web application visualizes hurricane paths and provides filters to explore historical storm data based on location, storm name, and year. The project is built using **HTML**, **CSS**, **JavaScript**, **D3.js**, and **Leaflet.js**.

---

## 🚀 **Features**
- 🗺️ Interactive Map: Visualize hurricane paths on a dynamic map using Leaflet.js.
- 🖱️ Region Selection: Use a brush tool to select specific areas on the map and filter storms within that region.
- 🌪️ Storm Filter: Filter storms by name and year using a dropdown and input field.
- 📊 Timeline Brush: Explore historical storm data by selecting a specific time range.
- 📍 Interactive Markers: Each storm marker provides details like storm name, wind speed, and year.

---

## 📂 **Project Structure**
```
📦 CAS-CaseComp-Storm-Map
├─ 📁 css          # Styling files
├─ 📁 data         # Storm dataset (CSV format)
├─ 📁 js           # JavaScript files for map and data visualization
├─ 📁 images       # Images and icons for the project
├─ 📄 index.html   # Main HTML file
└─ 📄 README.md    # Project documentation
```

---

## 🛠️ **Installation**
Follow these steps to set up the project locally:

1. **Clone the Repository:**
```bash
git clone https://github.com/lisazhong13/CAS-CaseComp-Storm-Map.git
cd CAS-CaseComp-Storm-Map
```

2. **Install Live Server (Optional but Recommended):**
If you are using VS Code, install the **Live Server** extension for easier preview.

3. **Run the Application:**
You can open `index.html` directly in your browser, but it's better to use a local server:
```bash
# Using Python (if installed)
python3 -m http.server 5500
```
Now, open `http://localhost:5500` in your browser.

---

## 🌐 **Usage**
1. Open the app and view the full map of storm trajectories.
2. **Filter by Region:** Use the brush tool to select a specific map area.
3. **Filter by Storm:** Select a storm name from the dropdown.
4. **Filter by Year:** Enter the number of past years to view storms from that period.
5. Click on any hurricane icon to see detailed information.

---

## 📊 **Data Source**
The data used in this project originally comes from the **CAS DATA VISUALIZATION CASE STUDY**, I cleaned the provided data, and **data** folder includes the following datasets:
- StormData.csv
- PropertyData.csv

---

## 🤝 **Contributing**
Contributions are welcome! Here's how you can help:
1. Fork the repository.
2. Create a new branch (`git checkout -b feature-new`).
3. Commit your changes (`git commit -m 'Add new feature'`).
4. Push to the branch (`git push origin feature-new`).
5. Open a Pull Request.

---

## 🙌 **Acknowledgments**
Special thanks to the developers of **D3.js**, **Leaflet.js**, and the **OpenStreetMap** community for providing the tools and data to make this project possible.

Thanks to **CAS** for providing the dataset which is fundamental to this project.

---

## 📧 **Contact**
For questions, suggestions, or collaboration opportunities, feel free to reach out!

💌 **GitHub:** [lisazhong13](https://github.com/lisazhong13)  
🌎 **LinkedIn:** [Jingwen Zhong](https://www.linkedin.com/in/jingwenzhong/)

---

⭐ If you find this project useful, please give it a star on [GitHub](https://github.com/lisazhong13/CAS-CaseComp-Storm-Map)! ⭐
