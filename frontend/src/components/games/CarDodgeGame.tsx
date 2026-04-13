import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw, Pause } from 'lucide-react';

interface Obstacle {
  id: number;
  lane: number;
  z: number;
}

interface CarProps {
  lane: number;
}

function Car({ lane }: CarProps) {
  const meshRef = useRef<THREE.Group>(null);
  const targetX = (lane - 1) * 2;

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.position.x = THREE.MathUtils.lerp(
        meshRef.current.position.x,
        targetX,
        0.15
      );
    }
  });

  return (
    <group ref={meshRef} position={[targetX, 0.3, 0]}>
      {/* Car body */}
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.4, 2]} />
        <meshStandardMaterial color="#3b82f6" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Car top */}
      <mesh position={[0, 0.35, -0.2]} castShadow>
        <boxGeometry args={[1, 0.4, 1]} />
        <meshStandardMaterial color="#2563eb" metalness={0.6} roughness={0.4} />
      </mesh>
      {/* Wheels */}
      {[[-0.5, -0.2, 0.6], [0.5, -0.2, 0.6], [-0.5, -0.2, -0.6], [0.5, -0.2, -0.6]].map(
        ([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        )
      )}
      {/* Headlights */}
      <mesh position={[-0.4, 0, 1]}>
        <boxGeometry args={[0.2, 0.15, 0.05]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[0.4, 0, 1]}>
        <boxGeometry args={[0.2, 0.15, 0.05]} />
        <meshStandardMaterial color="#fbbf24" emissive="#fbbf24" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

interface ObstacleMeshProps {
  obstacle: Obstacle;
  speed: number;
  onPassed: (id: number) => void;
  onCollision: () => void;
  playerLane: number;
}

function ObstacleMesh({ obstacle, speed, onPassed, onCollision, playerLane }: ObstacleMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const hasCollided = useRef(false);

  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.position.z += speed * delta * 60;

      // Check collision
      if (
        !hasCollided.current &&
        meshRef.current.position.z > -1 &&
        meshRef.current.position.z < 1.5 &&
        obstacle.lane === playerLane
      ) {
        hasCollided.current = true;
        onCollision();
      }

      // Remove when passed
      if (meshRef.current.position.z > 5) {
        onPassed(obstacle.id);
      }
    }
  });

  const x = (obstacle.lane - 1) * 2;

  return (
    <mesh ref={meshRef} position={[x, 0.4, obstacle.z]} castShadow>
      <boxGeometry args={[1.2, 0.8, 1.5]} />
      <meshStandardMaterial color="#ef4444" metalness={0.5} roughness={0.5} />
    </mesh>
  );
}

function Road() {
  const roadRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (roadRef.current) {
      const material = roadRef.current.material as THREE.MeshStandardMaterial;
      if (material.map) {
        material.map.offset.y -= delta * 2;
      }
    }
  });

  return (
    <group>
      {/* Road surface */}
      <mesh ref={roadRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 100]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {/* Lane dividers */}
      {[-1, 1].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x * 2, 0.01, 0]}>
          <planeGeometry args={[0.1, 100]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
      ))}
      {/* Road edges */}
      {[-4, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.15, 0]}>
          <boxGeometry args={[0.3, 0.3, 100]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      ))}
    </group>
  );
}

interface GameSceneProps {
  playerLane: number;
  obstacles: Obstacle[];
  speed: number;
  onObstaclePassed: (id: number) => void;
  onCollision: () => void;
  gameOver: boolean;
  score: number;
}

function GameScene({
  playerLane,
  obstacles,
  speed,
  onObstaclePassed,
  onCollision,
  gameOver,
  score,
}: GameSceneProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 8]} fov={60} />
      <OrbitControls enabled={false} />

      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight
        position={[5, 10, 5]}
        intensity={1}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />
      <pointLight position={[0, 3, -10]} intensity={0.5} color="#60a5fa" />

      {/* Sky gradient effect */}
      <mesh position={[0, 20, -50]}>
        <planeGeometry args={[200, 100]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>

      <Road />
      <Car lane={playerLane} />

      {obstacles.map((obstacle) => (
        <ObstacleMesh
          key={obstacle.id}
          obstacle={obstacle}
          speed={speed}
          onPassed={onObstaclePassed}
          onCollision={onCollision}
          playerLane={playerLane}
        />
      ))}

      {gameOver && (
        <Text
          position={[0, 3, -5]}
          fontSize={1}
          color="#ef4444"
          anchorX="center"
          anchorY="middle"
        >
          GAME OVER
        </Text>
      )}

      <Text
        position={[0, 4, -10]}
        fontSize={0.5}
        color="#fbbf24"
        anchorX="center"
        anchorY="middle"
      >
        Score: {score}
      </Text>
    </>
  );
}

interface CarDodgeGameProps {
  onGameEnd?: (score: number) => void;
  agentControlled?: boolean;
  agentAction?: 'left' | 'right' | 'stay' | null;
}

export function CarDodgeGame({ onGameEnd, agentControlled = false, agentAction }: CarDodgeGameProps) {
  const [playerLane, setPlayerLane] = useState(1); // 0, 1, 2 for left, center, right
  const [obstacles, setObstacles] = useState<Obstacle[]>([]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.15);
  const obstacleIdRef = useRef(0);
  const spawnIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const moveLeft = useCallback(() => {
    if (!gameOver && isPlaying) {
      setPlayerLane((prev) => Math.max(0, prev - 1));
    }
  }, [gameOver, isPlaying]);

  const moveRight = useCallback(() => {
    if (!gameOver && isPlaying) {
      setPlayerLane((prev) => Math.min(2, prev + 1));
    }
  }, [gameOver, isPlaying]);

  // Handle keyboard controls
  useEffect(() => {
    if (agentControlled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a') {
        moveLeft();
      } else if (e.key === 'ArrowRight' || e.key === 'd') {
        moveRight();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [moveLeft, moveRight, agentControlled]);

  // Handle agent actions
  useEffect(() => {
    if (!agentControlled || !agentAction) return;
    
    if (agentAction === 'left') moveLeft();
    else if (agentAction === 'right') moveRight();
  }, [agentAction, agentControlled, moveLeft, moveRight]);

  // Spawn obstacles
  useEffect(() => {
    if (!isPlaying || gameOver) {
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
      }
      return;
    }

    const spawnObstacle = () => {
      const lane = Math.floor(Math.random() * 3);
      setObstacles((prev) => [
        ...prev,
        { id: obstacleIdRef.current++, lane, z: -50 },
      ]);
    };

    spawnIntervalRef.current = setInterval(spawnObstacle, 1500 - Math.min(score * 10, 1000));
    return () => {
      if (spawnIntervalRef.current) {
        clearInterval(spawnIntervalRef.current);
      }
    };
  }, [isPlaying, gameOver, score]);

  // Increase speed over time
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const interval = setInterval(() => {
      setSpeed((prev) => Math.min(prev + 0.01, 0.4));
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, gameOver]);

  const handleObstaclePassed = (id: number) => {
    setObstacles((prev) => prev.filter((o) => o.id !== id));
    setScore((prev) => prev + 10);
  };

  const handleCollision = () => {
    setGameOver(true);
    setIsPlaying(false);
    onGameEnd?.(score);
  };

  const startGame = () => {
    setPlayerLane(1);
    setObstacles([]);
    setScore(0);
    setGameOver(false);
    setSpeed(0.15);
    setIsPlaying(true);
  };

  const togglePause = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="w-full max-w-2xl h-[400px] md:h-[500px] bg-slate-900 rounded-xl overflow-hidden border border-border">
        <Canvas shadows>
          <GameScene
            playerLane={playerLane}
            obstacles={obstacles}
            speed={speed}
            onObstaclePassed={handleObstaclePassed}
            onCollision={handleCollision}
            gameOver={gameOver}
            score={score}
          />
        </Canvas>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4">
        {!isPlaying && !gameOver && (
          <Button onClick={startGame} className="gap-2">
            <Play className="w-4 h-4" />
            Start Game
          </Button>
        )}
        {isPlaying && (
          <Button onClick={togglePause} variant="outline" className="gap-2">
            <Pause className="w-4 h-4" />
            Pause
          </Button>
        )}
        {gameOver && (
          <Button onClick={startGame} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Play Again
          </Button>
        )}
      </div>

      {/* Mobile Controls */}
      {isPlaying && !agentControlled && (
        <div className="flex gap-4 md:hidden">
          <Button size="lg" onClick={moveLeft} variant="outline">
            ← Left
          </Button>
          <Button size="lg" onClick={moveRight} variant="outline">
            Right →
          </Button>
        </div>
      )}

      <div className="text-center text-sm text-muted-foreground">
        <p>Score: <span className="font-mono font-bold text-primary">{score}</span></p>
        {!agentControlled && <p className="text-xs">Use ← → arrow keys or A/D to move</p>}
      </div>
    </div>
  );
}
