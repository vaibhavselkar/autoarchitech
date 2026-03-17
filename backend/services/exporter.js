const PDFDocument = require('pdfkit');
const DXFWriter = require('dxf-writer');

/**
 * Export floor plan to SVG format
 * @param {Object} layout - Floor plan layout data
 * @param {number} scale - Scale factor for export
 * @returns {string} SVG content
 */
function exportToSVG(layout, scale = 1) {
  const { plot, rooms, walls, doors, windows, dimensions } = layout;
  
  // Calculate SVG dimensions with padding
  const padding = 50;
  const svgWidth = (plot.width * scale) + (padding * 2);
  const svgHeight = (plot.length * scale) + (padding * 2);
  
  // Start building SVG content
  let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${svgWidth}" height="${svgHeight}" viewBox="0 0 ${svgWidth} ${svgHeight}" 
     xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <defs>
    <style>
      .plot-boundary { fill: none; stroke: #333; stroke-width: 2; }
      .room { fill: #f0f0f0; stroke: #666; stroke-width: 1; }
      .wall { fill: none; stroke: #000; stroke-width: 2; }
      .door { fill: none; stroke: #888; stroke-width: 1; }
      .window { fill: none; stroke: #aaa; stroke-width: 1; stroke-dasharray: 2,2; }
      .dimension { fill: none; stroke: #666; stroke-width: 1; }
      .dimension-text { font-family: Arial, sans-serif; font-size: 12px; fill: #333; }
      .room-label { font-family: Arial, sans-serif; font-size: 10px; fill: #666; text-anchor: middle; }
    </style>
  </defs>
  
  <g transform="translate(${padding}, ${padding})">`;

  // Draw plot boundary
  svgContent += `\n    <!-- Plot Boundary -->`;
  svgContent += `\n    <rect class="plot-boundary" x="0" y="0" width="${plot.width * scale}" height="${plot.length * scale}" />`;
  
  // Draw rooms
  svgContent += `\n    <!-- Rooms -->`;
  rooms.forEach(room => {
    const x = room.x * scale;
    const y = room.y * scale;
    const width = room.width * scale;
    const height = room.height * scale;
    
    svgContent += `\n    <rect class="room" x="${x}" y="${y}" width="${width}" height="${height}" />`;
    
    // Add room label
    svgContent += `\n    <text class="room-label" x="${x + width / 2}" y="${y + height / 2}">${room.label}</text>`;
  });
  
  // Draw walls
  svgContent += `\n    <!-- Walls -->`;
  walls.forEach(wall => {
    const x1 = wall.x1 * scale;
    const y1 = wall.y1 * scale;
    const x2 = wall.x2 * scale;
    const y2 = wall.y2 * scale;
    
    svgContent += `\n    <line class="wall" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" />`;
  });
  
  // Draw doors
  svgContent += `\n    <!-- Doors -->`;
  doors.forEach(door => {
    const x = door.x * scale;
    const y = door.y * scale;
    const width = door.width * scale;
    const height = door.height * scale;
    
    if (door.orientation === 'vertical') {
      svgContent += `\n    <line class="door" x1="${x}" y1="${y}" x2="${x}" y2="${y + height}" />`;
      svgContent += `\n    <path class="door" d="M${x} ${y} A${width} ${width} 0 0 1 ${x + width} ${y}" />`;
    } else {
      svgContent += `\n    <line class="door" x1="${x}" y1="${y}" x2="${x + width}" y2="${y}" />`;
    }
  });
  
  // Draw windows
  svgContent += `\n    <!-- Windows -->`;
  windows.forEach(window => {
    const x = window.x * scale;
    const y = window.y * scale;
    const width = window.width * scale;
    const height = window.height * scale;
    
    svgContent += `\n    <rect class="window" x="${x}" y="${y}" width="${width}" height="${height}" />`;
  });
  
  // Draw dimensions
  svgContent += `\n    <!-- Dimensions -->`;
  dimensions.forEach(dimension => {
    const x = dimension.position.x * scale;
    const y = dimension.position.y * scale;
    
    svgContent += `\n    <text class="dimension-text" x="${x}" y="${y}">${dimension.value}</text>`;
  });
  
  svgContent += `\n  </g>`;
  svgContent += `\n</svg>`;
  
  return svgContent;
}

/**
 * Export floor plan to PDF format
 * @param {Object} layout - Floor plan layout data
 * @param {number} scale - Scale factor for export
 * @returns {Buffer} PDF buffer
 */
function exportToPDF(layout, scale = 1) {
  return new Promise((resolve, reject) => {
    try {
      const { plot, rooms, walls, doors, windows, dimensions } = layout;
      
      // Create PDF document
      const doc = new PDFDocument({
        size: [plot.width * scale * 2, plot.length * scale * 2],
        margin: 50
      });
      
      const buffers = [];
      doc.on('data', chunk => buffers.push(chunk));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);
      
      // Set up drawing context
      const offsetX = 50;
      const offsetY = 50;
      
      // Draw plot boundary
      doc.rect(offsetX, offsetY, plot.width * scale, plot.length * scale);
      doc.lineWidth(2);
      doc.strokeColor('#333');
      doc.stroke();
      
      // Draw rooms
      rooms.forEach(room => {
        const x = offsetX + (room.x * scale);
        const y = offsetY + (room.y * scale);
        const width = room.width * scale;
        const height = room.height * scale;
        
        // Room fill
        doc.rect(x, y, width, height);
        doc.fillColor('#f0f0f0');
        doc.fill();
        
        // Room stroke
        doc.rect(x, y, width, height);
        doc.lineWidth(1);
        doc.strokeColor('#666');
        doc.stroke();
        
        // Room label
        doc.font('Helvetica');
        doc.fontSize(10);
        doc.fillColor('#333');
        doc.text(room.label, x + 5, y + 5, {
          width: width - 10,
          align: 'center'
        });
      });
      
      // Draw walls
      walls.forEach(wall => {
        const x1 = offsetX + (wall.x1 * scale);
        const y1 = offsetY + (wall.y1 * scale);
        const x2 = offsetX + (wall.x2 * scale);
        const y2 = offsetY + (wall.y2 * scale);
        
        doc.moveTo(x1, y1);
        doc.lineTo(x2, y2);
        doc.lineWidth(2);
        doc.strokeColor('#000');
        doc.stroke();
      });
      
      // Draw doors
      doors.forEach(door => {
        const x = offsetX + (door.x * scale);
        const y = offsetY + (door.y * scale);
        const width = door.width * scale;
        const height = door.height * scale;
        
        doc.moveTo(x, y);
        if (door.orientation === 'vertical') {
          doc.lineTo(x, y + height);
          // Draw arc for door swing
          doc.ellipse(x + width/2, y, width/2, width/2);
        } else {
          doc.lineTo(x + width, y);
        }
        doc.lineWidth(1);
        doc.strokeColor('#888');
        doc.stroke();
      });
      
      // Draw windows
      windows.forEach(window => {
        const x = offsetX + (window.x * scale);
        const y = offsetY + (window.y * scale);
        const width = window.width * scale;
        const height = window.height * scale;
        
        doc.rect(x, y, width, height);
        doc.dash(2, { space: 2 });
        doc.lineWidth(1);
        doc.strokeColor('#aaa');
        doc.stroke();
        doc.undash();
      });
      
      // Draw dimensions
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.fillColor('#666');
      
      dimensions.forEach(dimension => {
        const x = offsetX + (dimension.position.x * scale);
        const y = offsetY + (dimension.position.y * scale);
        
        doc.text(dimension.value.toString(), x, y);
      });
      
      // Add title and metadata
      doc.font('Helvetica-Bold');
      doc.fontSize(16);
      doc.fillColor('#000');
      doc.text('AutoArchitect Floor Plan', {
        align: 'center'
      });
      
      doc.font('Helvetica');
      doc.fontSize(10);
      doc.fillColor('#666');
      doc.text(`Generated on: ${new Date().toLocaleString()}`, {
        align: 'center'
      });
      
      doc.end();
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Export floor plan to DXF format (AutoCAD compatible)
 * @param {Object} layout - Floor plan layout data
 * @param {number} scale - Scale factor for export
 * @returns {string} DXF content
 */
function exportToDXF(layout, scale = 1) {
  const { plot, rooms, walls, doors, windows, dimensions } = layout;
  
  // Create DXF writer
  const dxf = new DXFWriter();
  
  // Set units to feet
  dxf.setUnits(4); // Architectural units
  
  // Draw plot boundary
  dxf.addLine(
    0, 0,
    plot.width * scale, 0
  );
  dxf.addLine(
    plot.width * scale, 0,
    plot.width * scale, plot.length * scale
  );
  dxf.addLine(
    plot.width * scale, plot.length * scale,
    0, plot.length * scale
  );
  dxf.addLine(
    0, plot.length * scale,
    0, 0
  );
  
  // Draw rooms
  rooms.forEach(room => {
    const x = room.x * scale;
    const y = room.y * scale;
    const width = room.width * scale;
    const height = room.height * scale;
    
    // Draw room rectangle
    dxf.addLine(x, y, x + width, y);
    dxf.addLine(x + width, y, x + width, y + height);
    dxf.addLine(x + width, y + height, x, y + height);
    dxf.addLine(x, y + height, x, y);
    
    // Add room label
    dxf.addText(room.label, x + width/2, y + height/2, 2);
  });
  
  // Draw walls
  walls.forEach(wall => {
    dxf.addLine(
      wall.x1 * scale, wall.y1 * scale,
      wall.x2 * scale, wall.y2 * scale
    );
  });
  
  // Draw doors
  doors.forEach(door => {
    const x = door.x * scale;
    const y = door.y * scale;
    const width = door.width * scale;
    const height = door.height * scale;
    
    if (door.orientation === 'vertical') {
      dxf.addLine(x, y, x, y + height);
      // Add arc for door swing
      dxf.addArc(x + width/2, y, width/2, 0, 90);
    } else {
      dxf.addLine(x, y, x + width, y);
    }
  });
  
  // Draw windows
  windows.forEach(window => {
    const x = window.x * scale;
    const y = window.y * scale;
    const width = window.width * scale;
    const height = window.height * scale;
    
    dxf.addLine(x, y, x + width, y);
    dxf.addLine(x + width, y, x + width, y + height);
    dxf.addLine(x + width, y + height, x, y + height);
    dxf.addLine(x, y + height, x, y);
  });
  
  // Draw dimensions
  dimensions.forEach(dimension => {
    const x = dimension.position.x * scale;
    const y = dimension.position.y * scale;
    
    dxf.addText(dimension.value.toString(), x, y, 1.5);
  });
  
  // Add title block
  dxf.addText('AutoArchitect Floor Plan', plot.width * scale / 2, -10, 3);
  dxf.addText(`Generated: ${new Date().toLocaleString()}`, plot.width * scale / 2, -15, 2);
  
  return dxf.toDxfString();
}

/**
 * Export floor plan to JSON format
 * @param {Object} layout - Floor plan layout data
 * @returns {string} JSON string
 */
function exportToJSON(layout) {
  return JSON.stringify(layout, null, 2);
}

/**
 * Export floor plan to 3D model format (simplified OBJ)
 * @param {Object} layout - Floor plan layout data
 * @param {number} scale - Scale factor for export
 * @returns {string} OBJ content
 */
function exportTo3D(layout, scale = 1) {
  const { plot, rooms, walls } = layout;
  let objContent = '# AutoArchitect 3D Model\n';
  let vertexIndex = 1;
  
  // Function to add a wall as 3D geometry
  const addWall3D = (wall, height = 10) => {
    const x1 = wall.x1 * scale;
    const y1 = wall.y1 * scale;
    const x2 = wall.x2 * scale;
    const y2 = wall.y2 * scale;
    const thickness = (wall.thickness || 0.3) * scale;
    
    // Calculate wall direction vector
    const dx = x2 - x1;
    const dy = y2 - y1;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate normal vector (perpendicular to wall)
    const nx = -dy / length;
    const ny = dx / length;
    
    // Create 4 vertices for the wall
    const v1 = { x: x1 + nx * thickness/2, y: y1 + ny * thickness/2, z: 0 };
    const v2 = { x: x1 - nx * thickness/2, y: y1 - ny * thickness/2, z: 0 };
    const v3 = { x: x2 - nx * thickness/2, y: y2 - ny * thickness/2, z: 0 };
    const v4 = { x: x2 + nx * thickness/2, y: y2 + ny * thickness/2, z: 0 };
    
    const v5 = { ...v1, z: height };
    const v6 = { ...v2, z: height };
    const v7 = { ...v3, z: height };
    const v8 = { ...v4, z: height };
    
    // Add vertices
    [v1, v2, v3, v4, v5, v6, v7, v8].forEach(v => {
      objContent += `v ${v.x} ${v.y} ${v.z}\n`;
    });
    
    // Add faces (two triangles per face)
    // Bottom face
    objContent += `f ${vertexIndex} ${vertexIndex + 1} ${vertexIndex + 2}\n`;
    objContent += `f ${vertexIndex} ${vertexIndex + 2} ${vertexIndex + 3}\n`;
    
    // Top face
    objContent += `f ${vertexIndex + 4} ${vertexIndex + 7} ${vertexIndex + 6}\n`;
    objContent += `f ${vertexIndex + 4} ${vertexIndex + 6} ${vertexIndex + 5}\n`;
    
    // Side faces
    objContent += `f ${vertexIndex} ${vertexIndex + 4} ${vertexIndex + 5}\n`;
    objContent += `f ${vertexIndex} ${vertexIndex + 5} ${vertexIndex + 1}\n`;
    
    objContent += `f ${vertexIndex + 1} ${vertexIndex + 5} ${vertexIndex + 6}\n`;
    objContent += `f ${vertexIndex + 1} ${vertexIndex + 6} ${vertexIndex + 2}\n`;
    
    objContent += `f ${vertexIndex + 2} ${vertexIndex + 6} ${vertexIndex + 7}\n`;
    objContent += `f ${vertexIndex + 2} ${vertexIndex + 7} ${vertexIndex + 3}\n`;
    
    objContent += `f ${vertexIndex + 3} ${vertexIndex + 7} ${vertexIndex + 4}\n`;
    objContent += `f ${vertexIndex + 3} ${vertexIndex + 4} ${vertexIndex}\n`;
    
    vertexIndex += 8;
  };
  
  // Add floor
  objContent += `v 0 0 0\n`;
  objContent += `v ${plot.width * scale} 0 0\n`;
  objContent += `v ${plot.width * scale} ${plot.length * scale} 0\n`;
  objContent += `v 0 ${plot.length * scale} 0\n`;
  objContent += `f 1 2 3 4\n`;
  
  vertexIndex = 5;
  
  // Add walls
  walls.forEach(wall => {
    addWall3D(wall);
  });
  
  return objContent;
}

module.exports = {
  exportToSVG,
  exportToPDF,
  exportToDXF,
  exportToJSON,
  exportTo3D
};