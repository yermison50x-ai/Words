import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, PerspectiveCamera } from '@react-three/drei';
import { WldWorld } from '../lib/WldParser';

interface WldViewerProps {
  world: WldWorld | null;
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

      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 10, 5]} intensity={1} />

      <Grid infiniteGrid cellSize={1} cellThickness={0.5} sectionSize={10} fadeDistance={100} />

      <mesh position={[0, 0, 0]}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#4a9eff" />
      </mesh>
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
