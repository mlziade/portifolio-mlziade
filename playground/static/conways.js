// Get canvas element and its 2D drawing context
const canvas = document.getElementById("gridCanvas");
const ctx = canvas.getContext("2d");

// Set canvas dimensions to full window size
let width = window.innerWidth;
let height = window.innerHeight;
canvas.width = width;
canvas.height = height;

// Configuration variables
let CELL_SIZE = 20;      // Size of each cell in pixels (now variable for zooming)
const MIN_CELL_SIZE = 5;   // Minimum cell size for zoom out
const MAX_CELL_SIZE = 50;  // Maximum cell size for zoom in
const ZOOM_FACTOR = 1.1;   // How much to zoom per scroll event
let isDragging = false;    // Tracks if user is currently panning the grid
let dragStart = { x: 0, y: 0 }; // Starting point of drag operation
let pan = { x: 0, y: 0 };  // Current pan/offset position of the grid
let running = false;       // Whether simulation is running or paused
let eventSource = null;    // Server-sent events source
let animationTimeout = null; // For controlling animation delay
let animationDelay = 100;  // Default animation delay in ms

// Create tooltip element to show cell coordinates
const tooltip = document.createElement('div');
tooltip.id = 'cell-tooltip';
tooltip.style.position = 'absolute';
tooltip.style.display = 'none';
tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
tooltip.style.color = 'white';
tooltip.style.padding = '5px';
tooltip.style.borderRadius = '3px';
tooltip.style.fontSize = '14px';
tooltip.style.pointerEvents = 'none'; // Prevents tooltip from interfering with mouse events
document.body.appendChild(tooltip);

// Set to track which cells are alive (using string keys like "x,y")
let aliveCells = new Set();

// Convert x,y coordinates to string keys for the Set
function posToKey(x, y) {
  return `${x},${y}`;
}

// Convert string key back to x,y coordinate array
function keyToPos(key) {
  return key.split(',').map(Number);
}

// Convert Set of cells to array format needed for API
function getAliveCellsArray() {
  return Array.from(aliveCells).map(keyToPos);
}

// Render the grid and all alive cells
function drawGrid() {
  ctx.clearRect(0, 0, width, height);
  ctx.strokeStyle = "#333";

  // Calculate grid dimensions and starting positions
  const cols = Math.ceil(width / CELL_SIZE);
  const rows = Math.ceil(height / CELL_SIZE);
  const startX = -Math.floor(pan.x / CELL_SIZE) - 1;
  const startY = -Math.floor(pan.y / CELL_SIZE) - 1;

  // Draw vertical grid lines
  for (let i = 0; i <= cols + 2; i++) {
    const x = i * CELL_SIZE + pan.x % CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }

  // Draw horizontal grid lines
  for (let i = 0; i <= rows + 2; i++) {
    const y = i * CELL_SIZE + pan.y % CELL_SIZE;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  // Draw the origin (0,0) cell in blue if it's not alive
  const originKey = posToKey(0, 0);
  if (!aliveCells.has(originKey)) {
    ctx.fillStyle = "#4da6ff";
    const originX = 0 * CELL_SIZE + pan.x;
    const originY = 0 * CELL_SIZE + pan.y;
    
    // Only draw if visible in viewport
    if (
      originX + CELL_SIZE >= 0 &&
      originY + CELL_SIZE >= 0 &&
      originX < width &&
      originY < height
    ) {
      ctx.fillRect(originX + 1, originY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  }

  // Draw all alive cells in green
  ctx.fillStyle = "#0f0";
  aliveCells.forEach(key => {
    const [x, y] = keyToPos(key);
    const screenX = x * CELL_SIZE + pan.x;
    const screenY = y * CELL_SIZE + pan.y;

    // Only draw cells visible in the viewport
    if (
      screenX + CELL_SIZE >= 0 &&
      screenY + CELL_SIZE >= 0 &&
      screenX < width &&
      screenY < height
    ) {
      ctx.fillRect(screenX + 1, screenY + 1, CELL_SIZE - 2, CELL_SIZE - 2);
    }
  });
}

// Convert mouse coordinates to grid cell coordinates
function getMouseCell(evt) {
  const rect = canvas.getBoundingClientRect();
  const x = evt.clientX - rect.left - pan.x;
  const y = evt.clientY - rect.top - pan.y;
  return [Math.floor(x / CELL_SIZE), Math.floor(y / CELL_SIZE)];
}

// Toggle a cell between alive and dead states
function toggleCell(x, y) {
  const key = posToKey(x, y);
  if (aliveCells.has(key)) {
    aliveCells.delete(key);
  } else {
    aliveCells.add(key);
  }
}

// Update grid with new alive cells from the server
function updateGrid(cellsArray) {
  aliveCells = new Set();
  cellsArray.forEach(([x, y]) => {
    aliveCells.add(posToKey(x, y));
  });
  drawGrid();
}

// Clear all cells from the grid
function clearGrid() {
  // Stop simulation if running
  if (running) {
    stopSimulation();
  }
  
  // Clear all alive cells
  aliveCells = new Set();
  
  // Redraw the grid
  drawGrid();
  console.log("Grid cleared");
}

// Connect to server-sent events stream and handle simulation
function startSimulation() {
  if (running) return;
  
  // Close any existing connection
  if (eventSource) {
    eventSource.close();
  }
  
  // Clear any pending animation
  if (animationTimeout) {
    clearTimeout(animationTimeout);
  }
  
  running = true;
  
  // Disable slider while running
  delaySlider.disabled = true;
  
  // Prepare request data - the current alive cells
  const requestData = {
    alive_cells: getAliveCellsArray()
  };
  
  console.log("Starting simulation with cells:", requestData.alive_cells);
  
  // Make the API request to start the simulation
  fetch('/playground/conways/stream/', {  // Use relative URL
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestData)
  })
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    
    // Modified to process one chunk at a time with delay
    function processStream() {
      if (!running) {
        console.log("Simulation stopped");
        return;
      }
      
      reader.read().then(({ done, value }) => {
        if (done) {
          console.log("Stream complete");
          running = false;
          return;
        }
        
        // Decode chunk and add to buffer
        const chunk = decoder.decode(value, { stream: true });
        console.log("Received chunk:", chunk);
        buffer += chunk;
        
        // Process complete messages in buffer
        const messages = buffer.split('\n\n');
        buffer = messages.pop(); // Keep the last incomplete message in buffer
        
        if (messages.length > 0) {
          // Just process the first complete message
          const message = messages[0];
          
          if (message.trim()) {
            try {
              // Extract just the JSON part from the SSE format
              const dataMatch = message.match(/^data: (.+)$/m);
              if (dataMatch && dataMatch[1]) {
                const data = JSON.parse(dataMatch[1]);
                console.log("Updating with grid state:", data);
                
                // Update grid immediately with this state
                updateGrid(data);
                
                // Keep any remaining messages in buffer for next processing
                buffer = messages.slice(1).join('\n\n') + '\n\n' + buffer;
                
                // Wait before processing next chunk
                animationTimeout = setTimeout(() => {
                  processStream();
                }, animationDelay); // Use variable delay instead of fixed 50ms
                
                return;
              }
            } catch (e) {
              console.error('Error parsing JSON:', e, 'from message:', message);
            }
          }
        }
        
        // If we didn't find a complete message to process, continue reading
        processStream();
      }).catch(error => {
        console.error('Stream error:', error);
        running = false;
      });
    }
    
    processStream();
  })
  .catch(error => {
    console.error('Fetch error:', error);
    running = false;
  });
}

// Stop the simulation
function stopSimulation() {
  running = false;
  
  // Enable slider when stopped
  delaySlider.disabled = false;
  
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  
  if (animationTimeout) {
    clearTimeout(animationTimeout);
    animationTimeout = null;
  }
  
  console.log("Simulation stopped");
}

// Mouse event handlers for panning and cell toggling
canvas.addEventListener("mousedown", e => {
  isDragging = true;
  dragStart = { x: e.clientX, y: e.clientY };
  canvas.style.cursor = "grabbing";
});

canvas.addEventListener("mouseup", e => {
  isDragging = false;
  canvas.style.cursor = "grab";
});

canvas.addEventListener("mousemove", e => {
  if (isDragging) {
    // Calculate how far the mouse moved since last position
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    
    // Update pan position
    pan.x += dx;
    pan.y += dy;
    
    // Update drag start position
    dragStart = { x: e.clientX, y: e.clientY };
    
    // Redraw with new pan position
    drawGrid();
    
    // Hide tooltip while dragging
    tooltip.style.display = 'none';
  } else {
    // Show current cell coordinates in tooltip
    const [x, y] = getMouseCell(e);
    tooltip.textContent = `[${x}, ${y}]`;
    tooltip.style.left = `${e.clientX + 10}px`; // Offset from cursor
    tooltip.style.top = `${e.clientY + 10}px`;
    tooltip.style.display = 'block';
  }
});

// Add mouseout event to hide tooltip when mouse leaves canvas
canvas.addEventListener("mouseout", () => {
  tooltip.style.display = 'none';
});

canvas.addEventListener("click", e => {
  if (!isDragging && !running) {
    // Toggle cell at clicked position (only when not running)
    const [x, y] = getMouseCell(e);
    toggleCell(x, y);
    drawGrid();
  }
});

// Handle window resizing
window.addEventListener("resize", () => {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  drawGrid();
});

// Initialize delay slider
const delaySlider = document.getElementById("delaySlider");
const delayValue = document.getElementById("delayValue");

delaySlider.addEventListener("input", function() {
  animationDelay = parseInt(this.value);
  delayValue.textContent = animationDelay + "ms";
});

// Button controls for starting/stopping simulation
document.getElementById("start").addEventListener("click", startSimulation);
document.getElementById("stop").addEventListener("click", stopSimulation);
document.getElementById("clear").addEventListener("click", clearGrid);
document.getElementById("center").addEventListener("click", centerGrid);

// Center grid function - positions (0,0) at the center of the screen
function centerGrid() {
  // Set pan to position (0,0) at the center of the viewport
  pan.x = Math.floor(width / 2);
  pan.y = Math.floor(height / 2);
  drawGrid();
  console.log("Grid centered");
}

// Handle zooming with mouse wheel
canvas.addEventListener("wheel", e => {
  e.preventDefault(); // Prevent page scrolling

  // Get mouse position before zoom
  const mouseX = e.clientX;
  const mouseY = e.clientY;
  
  // Get grid coordinates under mouse before zoom
  const gridX = (mouseX - pan.x) / CELL_SIZE;
  const gridY = (mouseY - pan.y) / CELL_SIZE;
  
  // Determine zoom direction
  const zoomIn = e.deltaY < 0;
  
  // Apply zoom
  if (zoomIn && CELL_SIZE < MAX_CELL_SIZE) {
    CELL_SIZE *= ZOOM_FACTOR;
  } else if (!zoomIn && CELL_SIZE > MIN_CELL_SIZE) {
    CELL_SIZE /= ZOOM_FACTOR;
  }
  
  // Clamp cell size to limits
  CELL_SIZE = Math.max(MIN_CELL_SIZE, Math.min(MAX_CELL_SIZE, CELL_SIZE));
  
  // Adjust pan to keep mouse position fixed in the grid
  pan.x = mouseX - gridX * CELL_SIZE;
  pan.y = mouseY - gridY * CELL_SIZE;
  
  // Redraw with new zoom level
  drawGrid();
}, { passive: false });

// Initial setup
centerGrid();
drawGrid();
console.log("Conway's Game of Life initialized");