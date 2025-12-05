import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { WldWorld } from '../lib/WldParser';
import * as THREE from 'three';
import { useMemo } from 'react';

interface WldViewerProps {
  world: WldWorld | null;
}

function BrushGeometry({ world }: { world: WldWorld }) {
  const meshes = useMemo(() => {
    const result: { geometry: THREE.BufferGeometry; color: string; }[] = [];

    for (const brush of world.brushes) {
      if (!brush.mips || brush.mips.length === 0) continue;

      const firstMip = brush.mips[0];

      for (const sector of firstMip.sectors) {
        for (const polygon of sector.polygons) {
          if (polygon.vertices.length < 3) continue;

          const vertices: number[] = [];
          const indices: number[] = [];

          if (polygon.indices && polygon.indices.length > 0) {
            for (const vertex of polygon.vertices) {
              vertices.push(vertex.x, vertex.y, vertex.z);
            }

            for (const index of polygon.indices) {
              indices.push(index);
            }
          } else {
            for (let i = 0; i < polygon.vertices.length; i++) {
              const vertex = polygon.vertices[i];
              vertices.push(vertex.x, vertex.y, vertex.z);
            }

            for (let i = 1; i < polygon.vertices.length - 1; i++) {
              indices.push(0, i, i + 1);
            }
          }

          const geometry = new THREE.BufferGeometry();
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
          geometry.setIndex(indices);
          geometry.computeVertexNormals();

          const color = `#${(polygon.color >>> 8).toString(16).padStart(6, '0')}`;

          result.push({ geometry, color });
        }
      }
    }

    return result;
  }, [world]);

  return (
    <>
      {meshes.map((mesh, index) => (
        <mesh key={index} geometry={mesh.geometry}>
          <meshStandardMaterial color={mesh.color} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  );
}

function Scene({ world }: { world: WldWorld | null }) {
  if (!world) {
    return (
      <mesh>
        <boxGeometry args={[2, 2, 2]} />
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }

  const bgColor = `#${world.backgroundColor.toString(16).padStart(6, '0')}`;

  return (
    <>
      <color attach="background" args={[bgColor]} />

      <ambientLight intensity={0.8} />
      <directionalLight position={[10, 10, 5]} intensity={0.5} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />

      <Grid infiniteGrid cellSize={1} cellThickness={0.5} sectionSize={10} fadeDistance={100} />

      {world.brushes.length > 0 ? (
        <BrushGeometry world={world} />
      ) : (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#ff6b6b" />
        </mesh>
      )}
    </>
  );
}

export function WldViewer({ world }: WldViewerProps) {
  return (
    <div className="viewer-container">
      <Canvas>
        <PerspectiveCamera makeDefault position={[10, 10, 10]} />
        <OrbitControls makeDefault />
        <Scene world={world} />
      </Canvas>
    </div>
  );
}
