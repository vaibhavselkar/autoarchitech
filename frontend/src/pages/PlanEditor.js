import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Stage, Layer, Rect, Text, Group, Line, Transformer } from 'react-konva';
import toast from 'react-hot-toast';
import api from '../services/api';

const PlanEditor = () => {
  const { planId } = useParams();
  const navigate = useNavigate();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedShape, setSelectedShape] = useState(null);
  const [tool, setTool] = useState('select'); // select, add-room, add-door, add-window

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    setLoading(true);
    try {
      const response = await api.get(`/plans/${planId}`);
      setPlan(response.data.data.plan);
    } catch (error) {
      toast.error('Failed to fetch plan');
      navigate('/results');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      await api.put(`/plans/${planId}`, {
        title: plan.title,
        description: plan.description,
        layoutJson: plan.layoutJson
      });
      toast.success('Plan saved successfully!');
    } catch (error) {
      toast.error('Failed to save plan');
    } finally {
      setLoading(false);
    }
  };

  const handleShapeClick = (e, shapeType, index) => {
    setSelectedShape({ type: shapeType, index });
  };

  const handleTransform = (newAttrs, shapeType, index) => {
    const updatedLayout = { ...plan.layoutJson };
    
    if (shapeType === 'room') {
      updatedLayout.rooms[index] = { ...updatedLayout.rooms[index], ...newAttrs };
    } else if (shapeType === 'wall') {
      updatedLayout.walls[index] = { ...updatedLayout.walls[index], ...newAttrs };
    }

    setPlan({ ...plan, layoutJson: updatedLayout });
  };

  const addRoom = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    const newRoom = {
      type: 'bedroom',
      x: (point.x - 50),
      y: (point.y - 25),
      width: 100,
      height: 50,
      label: 'New Room'
    };

    const updatedLayout = {
      ...plan.layoutJson,
      rooms: [...plan.layoutJson.rooms, newRoom]
    };

    setPlan({ ...plan, layoutJson: updatedLayout });
  };

  const addDoor = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    const newDoor = {
      x: point.x,
      y: point.y,
      width: 30,
      height: 70,
      orientation: 'vertical'
    };

    const updatedLayout = {
      ...plan.layoutJson,
      doors: [...plan.layoutJson.doors, newDoor]
    };

    setPlan({ ...plan, layoutJson: updatedLayout });
  };

  const addWindow = (e) => {
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    
    const newWindow = {
      x: point.x,
      y: point.y,
      width: 40,
      height: 40
    };

    const updatedLayout = {
      ...plan.layoutJson,
      windows: [...plan.layoutJson.windows, newWindow]
    };

    setPlan({ ...plan, layoutJson: updatedLayout });
  };

  const handleCanvasClick = (e) => {
    // Don't deselect if clicking on a shape
    const clickedOnShape = e.target !== e.target.getStage();
    if (!clickedOnShape) {
      setSelectedShape(null);
    }
  };

  const renderEditorCanvas = () => {
    if (!plan) return null;

    const layout = plan.layoutJson;
    const scale = 10; // 10 pixels per foot
    const offsetX = 50;
    const offsetY = 50;

    return (
      <Stage
        width={1200}
        height={800}
        onClick={handleCanvasClick}
        onMouseDown={(e) => {
          if (tool === 'add-room') addRoom(e);
          if (tool === 'add-door') addDoor(e);
          if (tool === 'add-window') addWindow(e);
        }}
      >
        <Layer>
          {/* Plot boundary */}
          <Rect
            x={offsetX}
            y={offsetY}
            width={layout.plot.width * scale}
            height={layout.plot.length * scale}
            stroke="#333"
            strokeWidth={4}
            fill="none"
            dash={[10, 5]}
          />

          {/* Rooms */}
          {layout.rooms.map((room, index) => (
            <Group
              key={index}
              x={offsetX + (room.x * scale)}
              y={offsetY + (room.y * scale)}
              width={room.width * scale}
              height={room.height * scale}
              onClick={(e) => handleShapeClick(e, 'room', index)}
              draggable
              onDragEnd={(e) => {
                const node = e.target;
                const scaleX = 1 / scale;
                const scaleY = 1 / scale;
                
                handleTransform({
                  x: (node.x() - offsetX) * scaleX,
                  y: (node.y() - offsetY) * scaleY
                }, 'room', index);
              }}
            >
              <Rect
                width={room.width * scale}
                height={room.height * scale}
                fill="#f0f0f0"
                stroke="#666"
                strokeWidth={2}
                cornerRadius={4}
              />
              <Text
                x={5}
                y={5}
                text={room.label}
                fontSize={12}
                fill="#333"
                fontFamily="Arial"
              />
              
              {selectedShape?.type === 'room' && selectedShape?.index === index && (
                <Transformer
                  boundBoxFunc={(oldBox, newBox) => {
                    // Limit minimum size
                    if (newBox.width < 30 || newBox.height < 30) {
                      return oldBox;
                    }
                    return newBox;
                  }}
                  onTransformEnd={(e) => {
                    const node = e.target.getParent();
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    
                    // Reset scale
                    node.scaleX(1);
                    node.scaleY(1);
                    
                    handleTransform({
                      width: (node.width() * scaleX) / scale,
                      height: (node.height() * scaleY) / scale
                    }, 'room', index);
                  }}
                />
              )}
            </Group>
          ))}

          {/* Walls */}
          {layout.walls.map((wall, index) => (
            <Line
              key={index}
              points={[
                offsetX + (wall.x1 * scale),
                offsetY + (wall.y1 * scale),
                offsetX + (wall.x2 * scale),
                offsetY + (wall.y2 * scale)
              ]}
              stroke="#000"
              strokeWidth={wall.thickness * scale * 2}
              lineCap="round"
              lineJoin="round"
              onClick={(e) => handleShapeClick(e, 'wall', index)}
            />
          ))}

          {/* Doors */}
          {layout.doors.map((door, index) => (
            <Line
              key={index}
              points={[
                offsetX + (door.x * scale),
                offsetY + (door.y * scale),
                offsetX + (door.x * scale),
                offsetY + ((door.y + door.height) * scale)
              ]}
              stroke="#888"
              strokeWidth={4}
              onClick={(e) => handleShapeClick(e, 'door', index)}
            />
          ))}

          {/* Windows */}
          {layout.windows.map((window, index) => (
            <Rect
              key={index}
              x={offsetX + (window.x * scale)}
              y={offsetY + (window.y * scale)}
              width={window.width * scale}
              height={window.height * scale}
              stroke="#aaa"
              strokeWidth={2}
              strokeDashArray={[8, 4]}
              fill="none"
              onClick={(e) => handleShapeClick(e, 'window', index)}
            />
          ))}

          {/* Dimensions */}
          {layout.dimensions.map((dimension, index) => (
            <Text
              key={index}
              x={offsetX + (dimension.position.x * scale)}
              y={offsetY + (dimension.position.y * scale)}
              text={dimension.value.toString()}
              fontSize={12}
              fill="#666"
              fontFamily="Arial"
            />
          ))}
        </Layer>
      </Stage>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Plan not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="bg-white shadow-md rounded-lg p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Plan Editor</h1>
          <div className="flex space-x-4">
            <button
              onClick={() => navigate('/results')}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-md"
            >
              Back to Results
            </button>
            <button
              onClick={() => navigate(`/export/${planId}`)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md"
            >
              Export Plan
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md"
            >
              Save Plan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Toolbar */}
          <div className="lg:col-span-1">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-4">Tools</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setTool('select')}
                  className={`w-full text-left p-2 rounded ${
                    tool === 'select' ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
                  }`}
                >
                  🖱️ Select Tool
                </button>
                <button
                  onClick={() => setTool('add-room')}
                  className={`w-full text-left p-2 rounded ${
                    tool === 'add-room' ? 'bg-green-100 text-green-900' : 'hover:bg-gray-100'
                  }`}
                >
                  🏠 Add Room
                </button>
                <button
                  onClick={() => setTool('add-door')}
                  className={`w-full text-left p-2 rounded ${
                    tool === 'add-door' ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
                  }`}
                >
                  🚪 Add Door
                </button>
                <button
                  onClick={() => setTool('add-window')}
                  className={`w-full text-left p-2 rounded ${
                    tool === 'add-window' ? 'bg-blue-100 text-blue-900' : 'hover:bg-gray-100'
                  }`}
                >
                  🪟 Add Window
                </button>
              </div>

              <div className="mt-6">
                <h4 className="font-medium text-gray-900 mb-2">Selected: {selectedShape ? `${selectedShape.type} ${selectedShape.index}` : 'None'}</h4>
                {selectedShape && (
                  <div className="text-sm text-gray-600">
                    Click and drag to move/resize shapes
                  </div>
                )}
              </div>
            </div>

            {/* Plan Info */}
            <div className="bg-gray-50 p-4 rounded-lg mt-4">
              <h3 className="font-semibold text-gray-900 mb-2">Plan Info</h3>
              <div className="space-y-2 text-sm text-gray-600">
                <div><span className="font-medium">Title:</span> {plan.title}</div>
                <div><span className="font-medium">Description:</span> {plan.description}</div>
                <div><span className="font-medium">Size:</span> {plan.layoutJson.plot.width}' x {plan.layoutJson.plot.length}'</div>
                <div><span className="font-medium">Rooms:</span> {plan.layoutJson.rooms?.length || 0}</div>
                <div><span className="font-medium">Created:</span> {new Date(plan.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className="lg:col-span-3">
            <div className="bg-gray-100 p-4 rounded-lg">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-gray-900">Floor Plan Canvas</h3>
                <div className="text-sm text-gray-600">
                  Tool: {tool} | Click canvas to add shapes, click shapes to select
                </div>
              </div>
              {renderEditorCanvas()}
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Editing Instructions</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Use the select tool to move and resize existing shapes</li>
            <li>• Use add tools to create new rooms, doors, and windows</li>
            <li>• Click and drag shapes to move them</li>
            <li>• Use corner handles to resize shapes</li>
            <li>• Remember to save your changes before leaving</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default PlanEditor;