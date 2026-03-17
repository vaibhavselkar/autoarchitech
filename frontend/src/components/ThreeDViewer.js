import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader';

const ThreeDViewer = ({ layout, multiFloorLayout, isMultiFloor = false }) => {
  const mountRef = useRef(null);
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const [currentFloor, setCurrentFloor] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (isMultiFloor && multiFloorLayout) {
      initMultiFloorViewer();
    } else if (!isMultiFloor && layout) {
      initSingleFloorViewer();
    }

    return () => {
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [layout, multiFloorLayout, isMultiFloor]);

  useEffect(() => {
    if (isMultiFloor && multiFloorLayout) {
      updateMultiFloorView();
    }
  }, [currentFloor]);

  const initSingleFloorViewer = () => {
    if (!layout || !mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(20, 25, 30);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const spotLight = new THREE.SpotLight(0xffffff, 1);
    spotLight.position.set(-10, 15, -10);
    spotLight.castShadow = true;
    scene.add(spotLight);

    // Build the 3D model
    buildSingleFloorModel(scene, layout);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    setIsLoaded(true);
  };

  const initMultiFloorViewer = () => {
    if (!multiFloorLayout || !mountRef.current) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(45, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 1000);
    camera.position.set(30, 40, 50);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(20, 40, 20);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Build the multi-floor model
    buildMultiFloorModel(scene, multiFloorLayout);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    setIsLoaded(true);
  };

  const buildSingleFloorModel = (scene, layout) => {
    const plot = layout.plot;
    
    // Plot boundary
    const plotGeometry = new THREE.BoxGeometry(plot.width, 0.5, plot.length);
    const plotMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const plotMesh = new THREE.Mesh(plotGeometry, plotMaterial);
    plotMesh.position.y = -0.25;
    plotMesh.receiveShadow = true;
    scene.add(plotMesh);

    // Rooms
    layout.rooms.forEach(room => {
      const roomGeometry = new THREE.BoxGeometry(room.width, room.height / 2, room.length || room.height);
      const roomMaterial = new THREE.MeshStandardMaterial({ 
        color: getRoomColor(room.type),
        roughness: 0.3,
        metalness: 0.1
      });
      const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
      
      roomMesh.position.set(room.x + room.width / 2, room.height / 4, room.y + (room.length || room.height) / 2);
      roomMesh.castShadow = true;
      roomMesh.receiveShadow = true;
      
      // Add room label
      addRoomLabel(scene, room.label, roomMesh.position);
      
      scene.add(roomMesh);
    });

    // Walls
    layout.walls.forEach(wall => {
      const wallGeometry = new THREE.BoxGeometry(
        Math.abs(wall.x2 - wall.x1) || 0.5,
        wall.height || 10,
        Math.abs(wall.y2 - wall.y1) || 0.5
      );
      const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
      const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
      
      const centerX = (wall.x1 + wall.x2) / 2;
      const centerY = wall.height || 10;
      const centerZ = (wall.y1 + wall.y2) / 2;
      
      wallMesh.position.set(centerX, centerY / 2, centerZ);
      wallMesh.castShadow = true;
      wallMesh.receiveShadow = true;
      
      scene.add(wallMesh);
    });
  };

  const buildMultiFloorModel = (scene, multiFloorLayout) => {
    const plot = multiFloorLayout.plot;
    
    // Plot boundary
    const plotGeometry = new THREE.BoxGeometry(plot.width, 0.5, plot.length);
    const plotMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });
    const plotMesh = new THREE.Mesh(plotGeometry, plotMaterial);
    plotMesh.position.y = -0.25;
    plotMesh.receiveShadow = true;
    scene.add(plotMesh);

    // Build each floor
    multiFloorLayout.floors.forEach((floor, index) => {
      const floorHeight = index * 10; // 10 feet per floor
      
      // Floor slab
      const slabGeometry = new THREE.BoxGeometry(plot.width, 0.5, plot.length);
      const slabMaterial = new THREE.MeshStandardMaterial({ color: 0xcccccc });
      const slabMesh = new THREE.Mesh(slabGeometry, slabMaterial);
      slabMesh.position.y = floorHeight;
      slabMesh.receiveShadow = true;
      scene.add(slabMesh);

      // Floor label
      addFloorLabel(scene, `Floor ${index + 1}`, plot.width / 2, floorHeight + 0.5, plot.length / 2);

      // Rooms for this floor
      floor.rooms.forEach(room => {
        const roomGeometry = new THREE.BoxGeometry(room.width, room.height / 2, room.height);
        const roomMaterial = new THREE.MeshStandardMaterial({ 
          color: getRoomColor(room.type),
          roughness: 0.3,
          metalness: 0.1
        });
        const roomMesh = new THREE.Mesh(roomGeometry, roomMaterial);
        
        roomMesh.position.set(
          room.x + room.width / 2, 
          floorHeight + room.height / 4, 
          room.y + room.height / 2
        );
        roomMesh.castShadow = true;
        roomMesh.receiveShadow = true;
        
        // Add room label
        addRoomLabel(scene, room.label, roomMesh.position);
        
        scene.add(roomMesh);
      });

      // Walls for this floor
      floor.walls.forEach(wall => {
        const wallGeometry = new THREE.BoxGeometry(
          Math.abs(wall.x2 - wall.x1) || 0.5,
          wall.height || 5,
          Math.abs(wall.y2 - wall.y1) || 0.5
        );
        const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
        const wallMesh = new THREE.Mesh(wallGeometry, wallMaterial);
        
        const centerX = (wall.x1 + wall.x2) / 2;
        const centerY = floorHeight + (wall.height || 5) / 2;
        const centerZ = (wall.y1 + wall.y2) / 2;
        
        wallMesh.position.set(centerX, centerY, centerZ);
        wallMesh.castShadow = true;
        wallMesh.receiveShadow = true;
        
        scene.add(wallMesh);
      });
    });

    // Staircase
    if (multiFloorLayout.staircase) {
      const staircase = multiFloorLayout.staircase;
      const stairGeometry = new THREE.BoxGeometry(staircase.width, staircase.height, staircase.height);
      const stairMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
      const stairMesh = new THREE.Mesh(stairGeometry, stairMaterial);
      
      stairMesh.position.set(
        staircase.x + staircase.width / 2,
        staircase.height / 2,
        staircase.y + staircase.height / 2
      );
      stairMesh.castShadow = true;
      scene.add(stairMesh);
    }
  };

  const updateMultiFloorView = () => {
    if (!sceneRef.current || !multiFloorLayout) return;

    // Hide all floors except current
    const meshes = sceneRef.current.children.filter(child => child.userData && child.userData.type === 'floor');
    meshes.forEach(mesh => {
      mesh.visible = mesh.userData.floorNumber === currentFloor;
    });

    // Adjust camera to focus on current floor
    if (cameraRef.current && controlsRef.current) {
      const targetY = currentFloor * 10 + 5;
      cameraRef.current.position.y = targetY + 15;
      controlsRef.current.target.set(0, targetY, 0);
    }
  };

  const getRoomColor = (roomType) => {
    const colors = {
      living_room: 0xe3f2fd,
      bedroom: 0xfff3e0,
      master_bedroom: 0xf3e5f5,
      kitchen: 0xe8f5e8,
      dining: 0xfff8e1,
      bathroom: 0xe0f2f1,
      study: 0xe1f5fe,
      balcony: 0xf5f5f5,
      terrace: 0xf5f5f5,
      prayer_room: 0xfff3e0
    };
    return colors[roomType] || 0xffffff;
  };

  const addRoomLabel = (scene, text, position) => {
    // Create a simple 3D text geometry (simplified for performance)
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'rgba(255, 255, 255, 0.8)';
    context.fillRect(0, 0, 256, 64);
    context.font = 'Bold 32px Arial';
    context.fillStyle = 'black';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(4, 1, 1);
    sprite.position.set(position.x, position.y + 2, position.z);
    scene.add(sprite);
  };

  const addFloorLabel = (scene, text, x, y, z) => {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;
    context.fillStyle = 'rgba(0, 150, 255, 0.9)';
    context.fillRect(0, 0, 256, 64);
    context.font = 'Bold 36px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(text, 128, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(6, 1.5, 1);
    sprite.position.set(x, y, z);
    scene.add(sprite);
  };

  const handleFloorChange = (floorIndex) => {
    setCurrentFloor(floorIndex);
  };

  const handleExport3D = () => {
    if (rendererRef.current) {
      const dataURL = rendererRef.current.domElement.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `floor-plan-3d-${isMultiFloor ? 'multi-floor' : 'single'}.png`;
      link.href = dataURL;
      link.click();
    }
  };

  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      <div ref={mountRef} className="w-full h-96 md:h-[500px]" />
      
      {isLoaded && (
        <div className="absolute top-4 left-4 bg-black bg-opacity-50 text-white p-3 rounded-lg">
          <h3 className="font-semibold mb-2">3D View Controls</h3>
          <p className="text-sm text-gray-300">• Left click: Rotate</p>
          <p className="text-sm text-gray-300">• Right click: Pan</p>
          <p className="text-sm text-gray-300">• Scroll: Zoom</p>
        </div>
      )}

      {isMultiFloor && multiFloorLayout && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-90 p-4 rounded-lg shadow-lg">
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium text-gray-700">Floor:</span>
            <div className="flex space-x-2">
              {multiFloorLayout.floors.map((floor, index) => (
                <button
                  key={index}
                  onClick={() => handleFloorChange(index)}
                  className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                    currentFloor === index
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {floor.floorName || `Floor ${index + 1}`}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="absolute top-4 right-4 flex space-x-2">
        <button
          onClick={handleExport3D}
          className="bg-blue-500 text-white px-3 py-1 rounded-md text-sm hover:bg-blue-600 transition-colors"
        >
          Export 3D View
        </button>
      </div>

      {!isLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-white text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
            <p>Loading 3D Viewer...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ThreeDViewer;