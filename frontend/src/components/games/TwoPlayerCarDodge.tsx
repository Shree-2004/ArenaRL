import { useRef, useState, useEffect, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera, Text } from '@react-three/drei';
import * as THREE from 'three';
import { Button } from '@/components/ui/button';
import { Play, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Obstacle {
  id: number;
  lane: number;
  z: number;
}

interface CarProps {
  lane: number;
  color: string;
}

function Car({ lane, color }: CarProps) {
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
      <mesh castShadow>
        <boxGeometry args={[1.2, 0.4, 2]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0.35, -0.2]} castShadow>
        <boxGeometry args={[1, 0.4, 1]} />
        <meshStandardMaterial color={color} metalness={0.6} roughness={0.4} />
      </mesh>
      {[[-0.5, -0.2, 0.6], [0.5, -0.2, 0.6], [-0.5, -0.2, -0.6], [0.5, -0.2, -0.6]].map(
        ([x, y, z], i) => (
          <mesh key={i} position={[x, y, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.2, 0.2, 0.15, 16]} />
            <meshStandardMaterial color="#1f2937" />
          </mesh>
        )
      )}
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

      if (
        !hasCollided.current &&
        meshRef.current.position.z > -1 &&
        meshRef.current.position.z < 1.5 &&
        obstacle.lane === playerLane
      ) {
        hasCollided.current = true;
        onCollision();
      }

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
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[8, 100]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
      {[-1, 1].map((x, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x * 2, 0.01, 0]}>
          <planeGeometry args={[0.1, 100]} />
          <meshStandardMaterial color="#fbbf24" />
        </mesh>
      ))}
      {[-4, 4].map((x, i) => (
        <mesh key={i} position={[x, 0.15, 0]}>
          <boxGeometry args={[0.3, 0.3, 100]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      ))}
    </group>
  );
}

interface SinglePlayerViewProps {
  playerLane: number;
  obstacles: Obstacle[];
  speed: number;
  onObstaclePassed: (id: number) => void;
  onCollision: () => void;
  gameOver: boolean;
  score: number;
  carColor: string;
  isWinner: boolean | null;
}

function SinglePlayerView({
  playerLane,
  obstacles,
  speed,
  onObstaclePassed,
  onCollision,
  gameOver,
  score,
  carColor,
  isWinner,
}: SinglePlayerViewProps) {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 5, 8]} fov={60} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1} castShadow />
      <pointLight position={[0, 3, -10]} intensity={0.5} color="#60a5fa" />
      <mesh position={[0, 20, -50]}>
        <planeGeometry args={[200, 100]} />
        <meshBasicMaterial color="#0f172a" />
      </mesh>
      <Road />
      <Car lane={playerLane} color={carColor} />
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
          color={isWinner ? "#22c55e" : "#ef4444"}
          anchorX="center"
          anchorY="middle"
        >
          {isWinner ? "WINNER!" : "CRASHED!"}
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

interface TwoPlayerCarDodgeProps {
  player1Type: 'human' | 'agent';
  player2Type: 'human' | 'agent';
  player1Action?: 'left' | 'right' | null;
  player2Action?: 'left' | 'right' | null;
  onGameEnd?: (winner: 1 | 2) => void;
  isFullscreen?: boolean;
  autoStart?: boolean;
}

export function TwoPlayerCarDodge({ 
  player1Type, 
  player2Type, 
  player1Action, 
  player2Action,
  onGameEnd,
  isFullscreen = false,
  autoStart = false,
}: TwoPlayerCarDodgeProps) {
  const [player1Lane, setPlayer1Lane] = useState(1);
  const [player2Lane, setPlayer2Lane] = useState(1);
  const [obstacles1, setObstacles1] = useState<Obstacle[]>([]);
  const [obstacles2, setObstacles2] = useState<Obstacle[]>([]);
  const [score1, setScore1] = useState(0);
  const [score2, setScore2] = useState(0);
  const [player1Crashed, setPlayer1Crashed] = useState(false);
  const [player2Crashed, setPlayer2Crashed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.15);
  const obstacleIdRef = useRef(0);
  const player1LaneRef = useRef(1);
  const player2LaneRef = useRef(1);

  // Keep refs in sync
  useEffect(() => {
    player1LaneRef.current = player1Lane;
  }, [player1Lane]);
  
  useEffect(() => {
    player2LaneRef.current = player2Lane;
  }, [player2Lane]);

  const gameOver = player1Crashed || player2Crashed;
  const winner = player1Crashed ? 2 : player2Crashed ? 1 : null;

  // Auto-start when autoStart prop is true
  useEffect(() => {
    if (autoStart && !isPlaying && !gameOver) {
      startGame();
    }
  }, [autoStart]);

  // Keyboard controls
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Player 1: A/D
      if (player1Type === 'human' && !player1Crashed) {
        if (e.key === 'a' || e.key === 'A') setPlayer1Lane(l => Math.max(0, l - 1));
        if (e.key === 'd' || e.key === 'D') setPlayer1Lane(l => Math.min(2, l + 1));
      }
      // Player 2: Arrow keys
      if (player2Type === 'human' && !player2Crashed) {
        if (e.key === 'ArrowLeft') setPlayer2Lane(l => Math.max(0, l - 1));
        if (e.key === 'ArrowRight') setPlayer2Lane(l => Math.min(2, l + 1));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, gameOver, player1Type, player2Type, player1Crashed, player2Crashed]);

  // Agent AI for Player 1 - proactive lane switching and dodging
  useEffect(() => {
    if (player1Type !== 'agent' || !isPlaying || player1Crashed) return;

    const aiInterval = setInterval(() => {
      const currentLane = player1LaneRef.current;
      
      // Find all incoming obstacles
      const incomingObstacles = obstacles1
        .filter(o => o.z > -40 && o.z < 3)
        .sort((a, b) => b.z - a.z); // Sort by distance (closest last)

      // Calculate threat level for each lane
      const laneThreat = [0, 0, 0];
      
      incomingObstacles.forEach(obs => {
        // Higher urgency for closer obstacles
        const distance = Math.abs(obs.z);
        const urgency = distance < 15 ? 100 : distance < 25 ? 50 : 20;
        laneThreat[obs.lane] += urgency;
      });

      // Find the safest lane
      let safestLane = currentLane;
      let minThreat = laneThreat[currentLane];

      // Check adjacent lanes first (prefer minimal movement)
      const adjacentLanes = [currentLane - 1, currentLane + 1].filter(l => l >= 0 && l <= 2);
      
      for (const lane of adjacentLanes) {
        if (laneThreat[lane] < minThreat) {
          minThreat = laneThreat[lane];
          safestLane = lane;
        }
      }

      // If current lane is dangerous and no better adjacent, check all lanes
      if (laneThreat[currentLane] > 30) {
        for (let lane = 0; lane <= 2; lane++) {
          if (laneThreat[lane] < minThreat) {
            minThreat = laneThreat[lane];
            safestLane = lane;
          }
        }
      }

      // Move towards safest lane
      if (safestLane < currentLane) {
        setPlayer1Lane(l => Math.max(0, l - 1));
      } else if (safestLane > currentLane) {
        setPlayer1Lane(l => Math.min(2, l + 1));
      }
    }, 80); // Faster reaction time

    return () => clearInterval(aiInterval);
  }, [player1Type, isPlaying, player1Crashed, obstacles1]);

  // Agent AI for Player 2 - proactive lane switching and dodging
  useEffect(() => {
    if (player2Type !== 'agent' || !isPlaying || player2Crashed) return;

    const aiInterval = setInterval(() => {
      const currentLane = player2LaneRef.current;
      
      // Find all incoming obstacles
      const incomingObstacles = obstacles2
        .filter(o => o.z > -40 && o.z < 3)
        .sort((a, b) => b.z - a.z);

      // Calculate threat level for each lane
      const laneThreat = [0, 0, 0];
      
      incomingObstacles.forEach(obs => {
        const distance = Math.abs(obs.z);
        const urgency = distance < 15 ? 100 : distance < 25 ? 50 : 20;
        laneThreat[obs.lane] += urgency;
      });

      // Find the safest lane
      let safestLane = currentLane;
      let minThreat = laneThreat[currentLane];

      const adjacentLanes = [currentLane - 1, currentLane + 1].filter(l => l >= 0 && l <= 2);
      
      for (const lane of adjacentLanes) {
        if (laneThreat[lane] < minThreat) {
          minThreat = laneThreat[lane];
          safestLane = lane;
        }
      }

      if (laneThreat[currentLane] > 30) {
        for (let lane = 0; lane <= 2; lane++) {
          if (laneThreat[lane] < minThreat) {
            minThreat = laneThreat[lane];
            safestLane = lane;
          }
        }
      }

      // Move towards safest lane
      if (safestLane < currentLane) {
        setPlayer2Lane(l => Math.max(0, l - 1));
      } else if (safestLane > currentLane) {
        setPlayer2Lane(l => Math.min(2, l + 1));
      }
    }, 80);

    return () => clearInterval(aiInterval);
  }, [player2Type, isPlaying, player2Crashed, obstacles2]);

  // External agent actions (from props)
  useEffect(() => {
    if (player1Type === 'agent' && player1Action && !player1Crashed) {
      if (player1Action === 'left') setPlayer1Lane(l => Math.max(0, l - 1));
      if (player1Action === 'right') setPlayer1Lane(l => Math.min(2, l + 1));
    }
  }, [player1Action, player1Type, player1Crashed]);

  useEffect(() => {
    if (player2Type === 'agent' && player2Action && !player2Crashed) {
      if (player2Action === 'left') setPlayer2Lane(l => Math.max(0, l - 1));
      if (player2Action === 'right') setPlayer2Lane(l => Math.min(2, l + 1));
    }
  }, [player2Action, player2Type, player2Crashed]);

  // Spawn obstacles - same obstacles for both players
  useEffect(() => {
    if (!isPlaying || gameOver) return;

    const spawnInterval = setInterval(() => {
      const lane = Math.floor(Math.random() * 3);
      const id1 = obstacleIdRef.current++;
      const id2 = obstacleIdRef.current++;
      const newObstacle1 = { id: id1, lane, z: -50 };
      const newObstacle2 = { id: id2, lane, z: -50 };
      setObstacles1(prev => [...prev, newObstacle1]);
      setObstacles2(prev => [...prev, newObstacle2]);
    }, 1500 - Math.min(Math.max(score1, score2) * 10, 1000));

    return () => clearInterval(spawnInterval);
  }, [isPlaying, gameOver, score1, score2]);

  // Speed increase
  useEffect(() => {
    if (!isPlaying || gameOver) return;
    const interval = setInterval(() => {
      setSpeed(prev => Math.min(prev + 0.01, 0.4));
    }, 5000);
    return () => clearInterval(interval);
  }, [isPlaying, gameOver]);

  const handleObstaclePassed1 = useCallback((id: number) => {
    setObstacles1(prev => prev.filter(o => o.id !== id));
    if (!player1Crashed) setScore1(s => s + 10);
  }, [player1Crashed]);

  const handleObstaclePassed2 = useCallback((id: number) => {
    setObstacles2(prev => prev.filter(o => o.id !== id));
    if (!player2Crashed) setScore2(s => s + 10);
  }, [player2Crashed]);

  const handleCollision1 = useCallback(() => {
    if (!player1Crashed && !player2Crashed) {
      setPlayer1Crashed(true);
      setIsPlaying(false);
      onGameEnd?.(2);
    }
  }, [player1Crashed, player2Crashed, onGameEnd]);

  const handleCollision2 = useCallback(() => {
    if (!player1Crashed && !player2Crashed) {
      setPlayer2Crashed(true);
      setIsPlaying(false);
      onGameEnd?.(1);
    }
  }, [player1Crashed, player2Crashed, onGameEnd]);

  const startGame = () => {
    setPlayer1Lane(1);
    setPlayer2Lane(1);
    player1LaneRef.current = 1;
    player2LaneRef.current = 1;
    setObstacles1([]);
    setObstacles2([]);
    setScore1(0);
    setScore2(0);
    setPlayer1Crashed(false);
    setPlayer2Crashed(false);
    setSpeed(0.15);
    setIsPlaying(true);
  };

  const containerHeight = isFullscreen ? 'h-[80vh]' : 'h-[400px]';

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <div className={cn("flex gap-4 w-full", containerHeight)}>
        {/* Player 1 View */}
        <div className="flex-1 flex flex-col">
          <div className="text-center text-sm font-medium text-agentX mb-2">
            Player 1 {player1Type === 'agent' ? '(Agent)' : '(Human)'} - Score: {score1}
          </div>
          <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border-2 border-agentX">
            <Canvas shadows>
              <SinglePlayerView
                playerLane={player1Lane}
                obstacles={obstacles1}
                speed={speed}
                onObstaclePassed={handleObstaclePassed1}
                onCollision={handleCollision1}
                gameOver={gameOver}
                score={score1}
                carColor="#ef4444"
                isWinner={winner === 1}
              />
            </Canvas>
          </div>
          {player1Type === 'human' && (
            <div className="text-center text-xs text-muted-foreground mt-2">A/D to move</div>
          )}
        </div>

        {/* Player 2 View */}
        <div className="flex-1 flex flex-col">
          <div className="text-center text-sm font-medium text-agentO mb-2">
            Player 2 {player2Type === 'agent' ? '(Agent)' : '(Human)'} - Score: {score2}
          </div>
          <div className="flex-1 bg-slate-900 rounded-xl overflow-hidden border-2 border-agentO">
            <Canvas shadows>
              <SinglePlayerView
                playerLane={player2Lane}
                obstacles={obstacles2}
                speed={speed}
                onObstaclePassed={handleObstaclePassed2}
                onCollision={handleCollision2}
                gameOver={gameOver}
                score={score2}
                carColor="#3b82f6"
                isWinner={winner === 2}
              />
            </Canvas>
          </div>
          {player2Type === 'human' && (
            <div className="text-center text-xs text-muted-foreground mt-2">← → to move</div>
          )}
        </div>
      </div>

      <div className="flex gap-4">
        {!isPlaying && !gameOver && !autoStart && (
          <Button onClick={startGame} className="gap-2">
            <Play className="w-4 h-4" />
            Start Game
          </Button>
        )}
        {gameOver && (
          <Button onClick={startGame} className="gap-2">
            <RotateCcw className="w-4 h-4" />
            Play Again
          </Button>
        )}
      </div>

      {gameOver && winner && (
        <div className={cn(
          "text-2xl font-bold",
          winner === 1 ? "text-agentX" : "text-agentO"
        )}>
          Player {winner} Wins!
        </div>
      )}
    </div>
  );
}
