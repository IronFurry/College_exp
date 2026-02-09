import { Stage, Layer, Rect, Transformer } from "react-konva";
import { useRef, useState, useEffect } from "react";


const App = () => {
  const [Selected, setSelected] = useState(false);
  const rectRef = useRef(null);
  const transformerRef = useRef(null)

  useEffect(() => {
    if (Selected && rectRef.current && transformerRef.current) {
      transformerRef.current.nodes([rectRef.current]);
      transformerRef.current.getLayer().batchDraw();
    }
  }, [Selected]);
  return (
    <div style={{ padding: "20px" }}>
      <h2>Slide Editor</h2>
      <Stage
        width={960}
        height={540}
        style={{ background: "#fff" }}
        onMouseDown={(e) => {
          if (e.target === e.target.getStage()) {
            setSelected(false)
          }
        }}
      >
        <Layer
          width={960}
          height={540}>
          <Rect
            ref={rectRef}
            x={100}
            y={100}
            width={200}
            height={120}
            fill="#4f46e5"
            draggable
            stroke={Selected ? "#22c55e" : null}
            strokeWidth={Selected ? 2 : 0}
            onClick={() => setSelected(true)}
            onTransformEnd={() => {
              const node = rectRef.current;

              const scaleX = node.scaleX();
              const scaleY = node.scaleY();

              // calculate new size
              const newWidth = Math.max(20, node.width() * scaleX);
              const newHeight = Math.max(20, node.height() * scaleY);

              // apply new size
              node.width(newWidth);
              node.height(newHeight);

              // reset scale
              node.scaleX(1);
              node.scaleY(1);
            }}

            strokeScaleEnabled={false}
          />

          {Selected && (
            <Transformer
              ref={transformerRef}
              rotateEnabled={true}
              resizeEnabled={true}
            />
          )}


        </Layer>
      </Stage>
    </div>
  )
}

export default App
