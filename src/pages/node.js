import React from 'react';
import 'antd/dist/antd.css';
import G6 from '@antv/g6';
import insertCss from 'insert-css';

  insertCss(`
  .g6-component-contextmenu {
    position: absolute;
    z-index: 2;
    list-style-type: none;
    background-color: #363b40;
    border-radius: 6px;
    font-size: 14px;
    color: hsla(0,0%,100%,.85);
    width: fit-content;
    transition: opacity .2s;
    text-align: center;
    padding: 0px 20px 0px 20px;
		box-shadow: 0 5px 18px 0 rgba(0, 0, 0, 0.6);
		border: 0px;
  }
  .g6-component-contextmenu ul {
		padding-left: 0px;
		margin: 0;
  }
  .g6-component-contextmenu li {
    cursor: pointer;
    list-style-type: none;
    list-style: none;
    margin-left: 0;
    line-height: 38px;
  }
  .g6-component-contextmenu li:hover {
    color: #aaaaaa;
	}
  .g6-tooltip {
    border: 1px solid #e2e2e2;
    border-radius: 4px;
    font-size: 12px;
    color: #545454;
    background-color: rgba(255, 255, 255, 0.9);
    padding: 10px 8px;
    box-shadow: rgb(174, 174, 174) 0px 0px 10px;
  }
`);




// Custom real node
G6.registerNode(
  'real-node',
  {
    draw(cfg, group) {
      
      let  r = cfg.size/2;
      
      const style = cfg.style;
      const color = cfg.color;
      const bonutSize = cfg['donut'].size
      const bonutColor = cfg['donut'].color
      // halo for hover
      group.addShape('circle', {
        attrs: {
          x: 0,
          y: 0,
          r: r + 5,
          fill: '#29870c',
          opacity: 0.9,
          lineWidth: 0,
        },
        name: 'halo-shape',
        visible: false,
      });

      // focus stroke for hover
      group.addShape('circle', {
        attrs: {
          x: 0,
          y: 0,
          r: r + 5,
          fill:'#a81d5b',
          stroke: '#fff',
          strokeOpacity: 0.85,
          lineWidth: 1,
        },
        name: 'stroke-shape',
        visible: false,
      });

      
      group.addShape('circle', {
        attrs: {
          x: 0,
          y: 0,
          r: r + bonutSize,
          fill:bonutColor,
          lineWidth: 0.5,
          stroke: '#FFFFFF',
        },
        name: 'border-radius',
      });

      //ping android begin
      group.addShape('circle', {
        attrs: {
          x: 0,
          y: 0,
          r: r + bonutSize,
          fill:bonutColor,
          lineWidth: 0.5,
          stroke: '#FFFFFF',
        },
        name: 'ping-radius',
      });
      //ping android end

      group.addShape('circle', {
        attrs: {
          ...style,
          x: 0,
          y: 0,
          r,
          fill: color,
          stroke: '#ffffff',
          lineWidth: 1,
          cursor: 'pointer',
        },
        name: 'aggregated-node-keyShape',
      });

      const keyShape = group.addShape('image', {
        attrs: {
          ...style,
          x: -r,
          y: -r,
          r,
          img:cfg["icon"].img,
          cursor: 'pointer',
          width: 2*r,
          height: 2*r,
          
        },
        name: 'image-node',
      });

      if (cfg.label) {
        const text = cfg.label;
        let labelStyle = {};
        let refY = 0;
        if (cfg.labelCfg) {
          labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
          refY += cfg.labelCfg.refY || 0;
        }
        let offsetY = 0;
        const fontSize = labelStyle.fontSize < 10 ? 10 : labelStyle.fontSize;
        const lineNum = cfg.labelLineNum || 1;
        offsetY = lineNum * (fontSize || 12);
        group.addShape('text', {
          attrs: {
            text,
            x: 0,
            y: r + refY + offsetY + 5,
            textAlign: 'center',
            textBaseLine: 'alphabetic',
            cursor: 'pointer',
            fontSize,
            fill: '#473837',
            opacity: 0.85,
            fontWeight: 400,
            stroke: '#473837',
          },
          name: 'text-shape',
          className: 'text-shape',
        });
      }
      // tag for new node
      
        group.addShape('circle', {
          attrs: {
            x: r + cfg['glyphs'].size/2,
            y: 0,
            r: cfg['glyphs'].size,
            fill: cfg['glyphs'].color,
            lineWidth: 0.5,
            stroke: '#FFFFFF',
          },
          name: 'typeNode-tag-circle',
        });
      

      return keyShape;
    },

    setState: (name, value, item) => {
      const group = item.get('group');
      const border = group.find((e) => e.get('name') === 'border-radius')
      const radius = border.attr('r');
      if (name === 'layoutEnd' && value) {
        const labelShape = group.find((e) => e.get('name') === 'text-shape');
        
        if (border) border.set('visible', true);
        if (labelShape) labelShape.set('visible', true);
      } else if (name === 'hover') {
        if (item.hasState('active')) {
          return
        }
      } else if (name === 'active') {
        const label = group.find((e) => e.get('name') === 'text-shape');
        if (value) {
          label && label.attr('fontWeight', 800);
        } else {       
          label && label.attr('fontWeight', 400);
        }
      } else if (name === 'selected') {
        const stroke = group.find((e) => e.get('name') === 'stroke-shape');
        const label = group.find((e) => e.get('name') === 'text-shape');
        const ping = group.find((e) => e.get('name') === 'ping-radius')
        console.log(radius);
        if (value) {
          stroke && stroke.show();
          border && border.hide();
          label && label.attr('fontWeight', 800);
          // ping animation begin
          ping && ping.animate(
            {
              // Magnifying and disappearing
              r: radius + 15,
              opacity: 0,
            },
            {
              duration: 500,
              easing: 'easeCubic',
              delay: 0,
              repeat: false, // repeat
            },
          ); // no delay
          // ping animation stop
        } else {
          stroke && stroke.hide();
          border && border.show();
          // ping animation begin
          ping && ping.stopAnimate();   
          ping.attr('opacity', 1)
          ping.attr('r', radius)
          // ping animation stop
          label && label.attr('fontWeight', 400);
        }
      }
    },
    update: undefined,
  },
  'aggregated-node',
);


// Custom the line edge for single edge between one node pair
G6.registerEdge(
    'default-line',
    {
      options:{
        style: {
          stroke: '#ccc',
        }
    },
      labelAutoRotate: true,

    draw(cfg, group) {
      const startPoint = cfg.startPoint;
      const endPoint = cfg.endPoint;
      const stroke = cfg.color;
      const lineWidth = cfg.size
      const shape = group.addShape('path', {
        attrs: {
          stroke,
          lineWidth,
          path: [
            ['M', startPoint.x, startPoint.y],
            ['L', endPoint.x, endPoint.y],
          ],
          startArrow: {
            path: 'M 0,0 L 12,6 L 9,0 L 12,-6 Z',
            fill: cfg.color,
          },
          endArrow: {
            path: 'M 0,0 L 12,6 L 9,0 L 12,-6 Z',
            fill: cfg.color,
          },
        },
        name: 'path-shape',
      });        
      
      // return the keyShape
      return shape;
    },
  },
  'single-edge',
);

// Custom the line edge for single edge between one node pair
G6.registerEdge(
  'active-line',
  {
    labelAutoRotate: true,

    draw(cfg, group) {
      const startPoint = cfg.startPoint;
      const endPoint = cfg.endPoint;
      const lineWidth = cfg.size
      const shape = group.addShape('path', {
        attrs: {
          lineWidth,
          path: [
            ['M', startPoint.x, startPoint.y],
            ['L', endPoint.x, endPoint.y],
          ],
          startArrow: {
            path: 'M 0,0 L 12,6 L 9,0 L 12,-6 Z',
            fill: '#e01032',
          },
          endArrow: {
            path: 'M 0,0 L 12,6 L 9,0 L 12,-6 Z',
            fill: '#e01032',
          },
        },
        name: 'path-shape',
      });        
      
      // return the keyShape
      return shape;
    },
    afterDraw(cfg, group){
      const shape = group.get('children')[0]
      const midPoint = shape.getPoint(0.5)
      const sPoint = shape.getPoint(0.15)
      const ePoint = shape.getPoint(0.85)

      group.addShape('circle',{
        attrs: {
          r:8,
          fill:'#e01032',
          x: midPoint.x,
          y: midPoint.y,
        },
        name:"midpoint"
      })

      // the left label
      group.addShape('text', {
        attrs: {
          text: 'start',
          fill: '#595959',
          textAlign: 'start',
          textBaseline: 'middle',
          x: sPoint.x,
          y: sPoint.y - 10,
        },
        name: 'left-text-shape',
      });
      
        // the right label
        group.addShape('text', {
          attrs: {
            text: 'end',
            fill: '#595959',
            textAlign: 'end',
            textBaseline: 'middle',
            x: ePoint.x,
            y: ePoint.y - 10,
          },
          name: 'right-text-shape',
        });

      const label = `${cfg.source}-${cfg.target}`; 
      // the right label
      group.addShape('text', {
        attrs: {
          text: label,
          fill: '#595959',
          textAlign: 'end',
          textBaseline: 'middle',
          x: midPoint.x,
          y: midPoint.y - 5,
        },
        name: 'middle-text-shape',
      });
    },
    update: undefined,
  },
  'single-edge',
);

function refreshDrageNodePosition(e) {
    const model = e.item.get('model');
    model.fx = e.x;
    model.fy = e.y;
}


  const NodeSample = (props) => {
    const ref = React.useRef(null);
  
  
    React.useEffect(() => {
        const graph = new G6.Graph({
            container: ref.current,
            width:1600,
            height:900,
            fitView: true,
            layout: {
              type: 'gForce',
              center: [600, 400], // The center of the graph by default
              linkDistance: 1,
              nodeStrength: 1000,
              edgeStrength: 200,             
              workerEnabled: true, // Whether to activate web-worker
              //gpuEnabled: true     // Whether to enable the GPU parallel computing, supported by G6 4.0,
              // type: 'fruchterman',
              // maxIteration: 300,
              // gravity: 10,
              // speed: 5,
              // clustering: true,
            },
            defaultEdge: {
                type:"default-line",
                
            },
            modes: {
                default: [
                    'drag-canvas', 
                    'drag-node', 
                    'drag-combo', 
                    'collapse-expand-combo',
                    {
                        type: 'tooltip',
                        formatText(model) {
                          const text = `<p align="left">
                            id : ${model.id} <br/>
                            color : ${model.color} <br/>
                            size : ${model.size} <br/>
                            x : ${model.x} <br/>
                            y : ${model.y} <br/>
                            label : ${model.label} <br/>
                            degree : ${model.degree} <br/>
                            dount : <br/>
                                { <br/>
                                  &nbsp;&nbsp;size: ${model['donut'].size} <br/>
                                  &nbsp;&nbsp;color: ${model['donut'].color} <br/>
                                } </br>
                            glyphs : <br/>
                            { <br/>
                              &nbsp;&nbsp;size: ${model['glyphs'].color} <br/>
                              &nbsp;&nbsp;color: ${model['glyphs'].size} <br/>
                              &nbsp;&nbsp;color: ${model['glyphs'].position} <br/>
                            }
                            </p>
                            `;
                          return text;
                        },
                        shouldUpdate: (e) => true,
                    },
                ],
    
            },
            
            
            defaultNode: {
                type: 'real-node',
                labelCfg: {
                  style:{
                    fill: '#000000',
                    fontSize: 8,
                    
                  },
                  position: 'bottom',
                },
            },
              
            nodeStateStyles: {
                active: {
                    fill: '#c5f567',
                    stroke: '#c5f567',
                },
            },
            defaultCombo: {
              type: 'circle',
              /* style for the keyShape */
               style: {
                 lineWidth: 1,
               },
              labelCfg: {
                /* label's offset to the keyShape */
                // refY: 10,
                /* label's position, options: center, top, bottom, left, right */
                position: 'top',
                /* label's style */
                 style: {
                   fontSize: 18,
               },
              },
          },
          });
    
        const nodes = props.data.nodes;
        // randomize the node size
        nodes.forEach((node) => {
            node.label = node.id
        });
        graph.data({
            nodes,
            edges: props.data.edges.map(function (edge, i) {
            edge.id = 'edge' + i;
            return Object.assign({}, edge);
            }),
        });
        graph.render();
  
  
      const clearFocusItemState = (graph) => {
          if (!graph) return;
          clearFocusNodeState(graph);
          clearFocusEdgeState(graph);
        };
        
        // Clear the focus state and corresponding style of all nodes on the graph
        const clearFocusNodeState = (graph) => {
          const focusNodes = graph.findAllByState('node', 'selected');
          focusNodes.forEach((fnode) => {
            graph.setItemState(fnode, 'selected', false); // false
          });
        };
        
        // Clear the focus state and corresponding styles of all edges on the graph
        const clearFocusEdgeState = (graph) => {
          const focusEdges = graph.findAllByState('edge', 'selected');
          focusEdges.forEach((fedge) => {
            graph.setItemState(fedge, 'selected', false);
            graph.updateItem(fedge, {
              type:'default-line',
            });
          });
        };
  

      // node active
      graph.on('node:mouseenter', (e) => {
          graph.getNodes().forEach((node) => {
            graph.setItemState(node, 'active', false);
          });
          graph.setItemState(e.item, 'active', true);
        });
        
      graph.on('node:mouseleave', (e) => {
        graph.setItemState(e.item, 'active', false);
      });
        
      graph.on('node:click', (e) => {
        clearFocusItemState(graph);
        graph.setItemState(e.item, 'selected', true);
        
        // Also highlight the relevant edges
        const relatedEdges = e.item.getEdges();
        relatedEdges.forEach((edge) => {
          graph.setItemState(edge, 'selected', true);
          console.log("node click")
          graph.updateItem(edge, {
            type:'active-line',
          });
       });

      });
        
      graph.on('canvas:click', (e) => {
        clearFocusItemState(graph);
        graph.getCombos().forEach((combo) => {
          graph.clearItemStates(combo);
        });
      });
  
      graph.on('node:dragstart', function (e) {
          graph.layout();
          refreshDrageNodePosition(e);
      });
      graph.on('node:drag', function (e) {
          //const forceLayout = graph.get('layoutController').layoutMethods[0];
          //forceLayout.execute();
          refreshDrageNodePosition(e);
      });
  
      //edge selection
      graph.on('edge:mouseenter', (evt) => {
        const { item } = evt;
        graph.setItemState(item, 'active', true);
      });
      
      graph.on('edge:mouseleave', (evt) => {
        const { item } = evt;
        graph.setItemState(item, 'active', false);
      });
      
      graph.on('edge:click', (evt) => {
        clearFocusItemState(graph);
        const { item } = evt;
        graph.setItemState(item, 'selected', true);
        console.log("edge:click")
        graph.updateItem(item, {
          type:'active-line',
        });
      });

      graph.on('combo:mouseenter', (evt) => {
        const { item } = evt;
        graph.setItemState(item, 'active', true);
      });
      
      graph.on('combo:mouseleave', (evt) => {
        const { item } = evt;
        graph.setItemState(item, 'active', false);
      });
      graph.on('combo:click', (evt) => {
        const { item } = evt;
        graph.setItemState(item, 'selected', true);
      });

      //edge selection
      return () => {
          graph.changeData(props.data);
      };
    });
  
    return <>
        <div ref={ref}></div>
    </>;
  }

export default NodeSample
