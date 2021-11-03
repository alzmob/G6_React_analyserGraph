import React from 'react';
import 'antd/dist/antd.css';
import G6 from '@antv/g6';
import insertCss from 'insert-css';

//const { isNumber, isArray } = window.AntVUtil;
import { isNumber, isArray } from '@antv/util';

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

const { louvain, labelPropagation} = G6.Algorithm;
const { uniqueId } = G6.Util;

const NODESIZEMAPPING = 'degree';
const SMALLGRAPHLABELMAXLENGTH = 5;
let labelMaxLength = SMALLGRAPHLABELMAXLENGTH;
const DEFAULTNODESIZE = 25;
const DEFAULTAGGREGATEDNODESIZE = 53;

let graph = null;
let currentUnproccessedData = { nodes: [], edges: [] };
let nodeMap = {};
let aggregatedNodeMap = {};
let hiddenItemIds = []; 
let largeGraphMode = true;
let cachePositions = {};
let manipulatePosition = undefined;
let descreteNodeCenter;
let layout = {
  type: '',
  instance: null,
  destroyed: true,
};
let expandArray = [];
let collapseArray = [];
let shiftKeydown = false;
let CANVAS_WIDTH = 1600,
  CANVAS_HEIGHT = 900;

const animateOpacity = 0.6;
const realEdgeOpacity = 0.2;

const subjectColors = [
  '#005eff', // blue
  '#005eff',
];
const backColor = '#61DDAA';
const theme = 'default';
const disableColor = '#61DDAA';
const colorSets = G6.Util.getColorSetsBySubjectColors(
  subjectColors,
  backColor,
  theme,
  disableColor,
);

const global = {
  node: {
    labelCfg: {
      style:{
        fill: '#ffffff',
        fontSize: 10,
        background: {
          fill: '#1890ff',
          stroke: '#9EC9FF',
          padding: [1, 1, 1, 1],
          radius: 2,
        }
      },
      position: 'bottom',
    },
    style:{
        fill: colorSets[1].mainFill,
        stroke: colorSets[1].mainStroke,
    },
  },
  edge: {
    style: {
      stroke: '#6da6c1',
      realEdgeStroke: '#23a411', //'#f00',
      realEdgeOpacity,
      strokeOpacity: realEdgeOpacity,
    },
    stateStyles: {
      focus: {
        stroke: '#fff', // '#3C9AE8',
      },
    },
  },
};

G6.registerNode(
'aggregated-node',
{
  draw(cfg, group) {
    
    let r = 20;
    if (isNumber(cfg.size)) {
      r = cfg.size / 2;
    } else if (isArray(cfg.size)) {
      r = cfg.size[0] / 2;
    }
    const style = cfg.style || {};
    const colorSet = cfg.colorSet || colorSets[0];

    // halo for hover
    group.addShape('circle', {
      attrs: {
        x: 0,
        y: 0,
        r: r + 5,
        fill: '#095ae3',
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
        fill: '#095ae3',
        stroke: '#fff',
        strokeOpacity: 0.85,
        lineWidth: 3,
      },
      name: 'stroke-shape',
      visible: false,
    });

    const keyShape = group.addShape('circle', {
      attrs: {
        ...style,
        x: 0,
        y: 0,
        r,
        fill: '#d5336f',
        stroke: colorSet.mainStroke,
        lineWidth: 5,
        cursor: 'pointer',
      },
      name: 'aggregated-node-keyShape',
    });

    let labelStyle = {};
    if (cfg.labelCfg) {
      labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
    }
    

    group.addShape('circle', {
      attrs: {
        label:`${cfg.count}`,
        x: r - 5,
        y: -r + 5,
        r: 12,
        fill: '#3b8eff',
        lineWidth: 0.5,
        stroke: '#FFFFFF',
        labelCfg: {
          style:{
            fill: '#ffffff',
            fontSize: 10,
          },
          position: 'bottom',
        },
      },
      name: 'typeNode-tag-circle',
    });

    group.addShape('text', {
      attrs: {
        text: `${cfg.count}`,
        x: r - 5,
        y: -r + 12,
        cursor: 'pointer',
        fontSize: 12,
        fill: '#fff',
        textAlign: 'center',
        textBaseLine: 'alphabetic',
        opacity: 0.85,
        fontWeight: 400,
      },
      name: 'count-shape',
      className: 'count-shape',
      draggable: true,
    });
    group.addShape('image', {
      attrs: {
        ...style,
        x: -r/2,
        y: -r/2,
        r,
        img:'https://gw.alipayobjects.com/zos/basement_prod/012bcf4f-423b-4922-8c24-32a89f8c41ce.svg',
        cursor: 'pointer',
        
      },
      name: 'image-node',
    });
    return keyShape;
  },
  setState: (name, value, item) => {
    const group = item.get('group');
    if (name === 'layoutEnd' && value) {
      const labelShape = group.find((e) => e.get('name') === 'text-shape');
      if (labelShape) labelShape.set('visible', true);
    } else if (name === 'hover') {
      if (item.hasState('focus')) {
        return;
      }
      const halo = group.find((e) => e.get('name') === 'halo-shape');
      const keyShape = item.getKeyShape();
      const colorSet = item.getModel().colorSet || colorSets[0];
      if (value) {
        halo && halo.show();
        keyShape.attr('fill', colorSet.activeFill);
      } else {
        halo && halo.hide();
        keyShape.attr('fill', '#d5336f');
      }
    } else if (name === 'focus') {
      const stroke = group.find((e) => e.get('name') === 'stroke-shape');
      const keyShape = item.getKeyShape();
      const colorSet = item.getModel().colorSet || colorSets[0];
      if (value) {
        stroke && stroke.show();
        keyShape.attr('fill', colorSet.selectedFill);
      } else {
        stroke && stroke.hide();
        keyShape.attr('fill', '#d5336f');
      }
    }
  },
  update: undefined,
},
'single-node',
);

// Custom real node
G6.registerNode(
'real-node',
{
  draw(cfg, group) {
    let r = 30;
    
      r = cfg.size / 2;
    
      //r = cfg.size[0] / 2;
    
    const style = cfg.style || {};
    const colorSet = cfg.colorSet || colorSets[0];

    // halo for hover
    group.addShape('circle', {
      attrs: {
        x: 0,
        y: 0,
        r: r + 5,
        fill: style.fill || colorSet.mainFill || '#2B384E',
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
        fill: style.fill || colorSet.mainFill || '#2B384E',
        stroke: '#fff',
        strokeOpacity: 0.85,
        lineWidth: 1,
      },
      name: 'stroke-shape',
      visible: false,
    });

    const keyShape = group.addShape('circle', {
      attrs: {
        ...style,
        x: 0,
        y: 0,
        r,
        fill: '#17d03a',
        stroke: colorSet.mainStroke,
        lineWidth: 7,
        cursor: 'pointer',
        
      },
      name: 'aggregated-node-keyShape',
    });
    group.addShape('image', {
      attrs: {
        ...style,
        x: -r+5,
        y: -r+5,
        r,
        img:'https://gw.alipayobjects.com/zos/basement_prod/012bcf4f-423b-4922-8c24-32a89f8c41ce.svg',
        cursor: 'pointer',
        
      },
      name: 'image-node',
    });

    let labelStyle = {};
    if (cfg.labelCfg) {
      labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
    }

    if (cfg.label) {
      const text = cfg.label;
      let labelStyle = {};
      let refY = 0;
      if (cfg.labelCfg) {
        labelStyle = Object.assign(labelStyle, cfg.labelCfg.style);
        refY += cfg.labelCfg.refY || 0;
      }
      let offsetY = 0;
      const fontSize = labelStyle.fontSize < 8 ? 8 : labelStyle.fontSize;
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
          fill: '#000000',
          opacity: 0.85,
          fontWeight: 400
        },
        name: 'text-shape',
        className: 'text-shape',
      });
    }

    // tag for new node
    if (cfg.new) {
      group.addShape('circle', {
        attrs: {
          x: r - 3,
          y: -r + 3,
          r: 4,
          fill: '#3b8eff',
          lineWidth: 0.5,
          stroke: '#FFFFFF',
        },
        name: 'typeNode-tag-circle',
      });
    }

    return keyShape;
  },
  setState: (name, value, item) => {
    const group = item.get('group');
    if (name === 'layoutEnd' && value) {
      const labelShape = group.find((e) => e.get('name') === 'text-shape');
      if (labelShape) labelShape.set('visible', true);
    } else if (name === 'hover') {
      if (item.hasState('focus')) {
        return;
      }
      const halo = group.find((e) => e.get('name') === 'halo-shape');
      const keyShape = item.getKeyShape();
      //const colorSet = item.getModel().colorSet || colorSets[0];
      if (value) {
        halo && halo.show();
        keyShape.attr('fill', '#c3eecb');
      } else {
        halo && halo.hide();
        keyShape.attr('fill', '#17d03a');
      }
    } else if (name === 'focus') {
      const stroke = group.find((e) => e.get('name') === 'stroke-shape');
      const label = group.find((e) => e.get('name') === 'text-shape');
      const keyShape = item.getKeyShape();
      //const colorSet = item.getModel().colorSet || colorSets[0];
      if (value) {
        stroke && stroke.show();
        keyShape.attr('fill', '#c3eecb');
        label && label.attr('fontWeight', 800);
      } else {
        stroke && stroke.hide();
        keyShape.attr('fill', '#17d03a'); // '#17d03a'
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
'custom-line',
{
  setState: (name, value, item) => {
    const group = item.get('group');
    const model = item.getModel();
    if (name === 'focus') {
      const keyShape = group.find((ele) => ele.get('name') === 'edge-shape');
      const back = group.find((ele) => ele.get('name') === 'back-line');
      if (back) {
        back.stopAnimate();
        back.remove();
        back.destroy();
      }
      const arrow = model.style.endArrow;
      if (value) {
        if (keyShape.cfg.animation) {
          keyShape.stopAnimate(true);
        }
        keyShape.attr({
          strokeOpacity: animateOpacity,
          opacity: animateOpacity,
          stroke: '#c20027',
          lineWidth: 1,
           endArrow: {
             ...arrow,
             stroke: '#c20027',
             fill: '#c20027',
           },
        });
      } else {
        keyShape.stopAnimate();
        const stroke = model.isReal ? global.edge.style.realEdgeStroke : global.edge.style.stroke;
        keyShape.attr({
          stroke,
           endArrow: {
             ...arrow,
             stroke,
             fill: stroke,
           },
        });
      }
    }
  },
},
'single-edge',
);

const descendCompare = (p) => {
  // This is the comparison function
  return function (m, n) {
    const a = m[p];
    const b = n[p];
    return b - a; // Descending
  };
};

const clearFocusItemState = (graph) => {
  if (!graph) return;
  clearFocusNodeState(graph);
  clearFocusEdgeState(graph);
};

// Clear the focus state and corresponding style of all nodes on the graph
const clearFocusNodeState = (graph) => {
  const focusNodes = graph.findAllByState('node', 'focus');
  focusNodes.forEach((fnode) => {
    graph.setItemState(fnode, 'focus', false); // false
  });
};

// Clear the focus state and corresponding styles of all edges on the graph
const clearFocusEdgeState = (graph) => {
  const focusEdges = graph.findAllByState('edge', 'focus');
  focusEdges.forEach((fedge) => {
    graph.setItemState(fedge, 'focus', false);
  });
};

// Truncate long text. length is the length of the text after truncation, elipsis is the suffix
const formatText = (text, length = 5, elipsis = '...') => {
  if (!text) return '';
  if (text.length > length) {
    return `${text.substr(0, length)}${elipsis}`;
  }
  return text;
};

const labelFormatter = (text, minLength = 10) => {
  if (text && text.split('').length > minLength) return `${text.substr(0, minLength)}...`;
  return text;
};


function scaleNodeProp(count, sizeRange, countRange) {
  const sizelength = sizeRange[1] - sizeRange[0];
  const countLength = countRange[1] - countRange[0];
  return count/countLength*sizelength + sizeRange[0];

}

const processNodesEdges = (
  nodes,
  edges,
  width,
  height,
  largeGraphMode,
  edgeLabelVisible,
  isNewGraph = false,
) => {
  if (!nodes || nodes.length === 0) return {};
  const currentNodeMap = {};
  let maxNodeCount = -Infinity;
  const paddingRatio = 0.3;
  const paddingLeft = paddingRatio * width;
  const paddingTop = paddingRatio * height;
  nodes.forEach((node) => {
    node.type = node.level === 0 ? 'real-node' : 'aggregated-node';
    node.isReal = node.level === 0 ? true : false;
    node.label = `${node.id}`;
    node.labelLineNum = undefined;
    node.oriLabel = node.label;
    node.label = formatText(node.label, labelMaxLength, '...');
    node.degree = 0;
    node.inDegree = 0;
    node.outDegree = 0;
    if (currentNodeMap[node.id]) {
      console.warn('node exists already!', node.id);
      node.id = `${node.id}${Math.random()}`;
    }
    currentNodeMap[node.id] = node;
    if (node.count > maxNodeCount) maxNodeCount = node.count;
    const cachePosition = cachePositions ? cachePositions[node.id] : undefined;
    if (cachePosition) {
      node.x = cachePosition.x;
      node.y = cachePosition.y;
      node.new = false;
    } else {
      node.new = isNewGraph ? false : true;
      if (manipulatePosition && !node.x && !node.y) {
        node.x = manipulatePosition.x + 30 * Math.cos(Math.random() * Math.PI * 2);
        node.y = manipulatePosition.y + 30 * Math.sin(Math.random() * Math.PI * 2);
      }
    }
});

let maxCount = -Infinity;
let minCount = Infinity;
// let maxCount = 0;
edges.forEach((edge) => {
  // to avoid the dulplicated id to nodes
  if (!edge.id) edge.id = `edge-${uniqueId()}`;
  else if (edge.id.split('-')[0] !== 'edge') edge.id = `edge-${edge.id}`;
  // TODO: delete the following line after the queried data is correct
  if (!currentNodeMap[edge.source] || !currentNodeMap[edge.target]) {
    console.warn('edge source target does not exist', edge.source, edge.target, edge.id);
    return;
  }
  const sourceNode = currentNodeMap[edge.source];
  const targetNode = currentNodeMap[edge.target];

  if (!sourceNode || !targetNode)
    console.warn('source or target is not defined!!!', edge, sourceNode, targetNode);

  // calculate the degree
  sourceNode.degree++;
  targetNode.degree++;
  sourceNode.outDegree++;
  targetNode.inDegree++;

  if (edge.count > maxCount) maxCount = edge.count;
  if (edge.count < minCount) minCount = edge.count;
});

nodes.sort(descendCompare(NODESIZEMAPPING));
const maxDegree = nodes[0].degree || 1;

const descreteNodes = [];
const sizeRange = [30, 60];
const countdataRange = [minCount, maxCount];
nodes.forEach((node, i) => {
  // assign the size mapping to the outDegree
  const countRatio = node.count / maxNodeCount;
  const isRealNode = node.level === 0;
  node.size = isRealNode ? DEFAULTNODESIZE : scaleNodeProp(node.count, sizeRange, countdataRange);
  node.isReal = isRealNode;
  node.labelCfg = {
    position: 'bottom',
    offset: 5,
    style: {
      fill: global.node.labelCfg.style.fill,
      fontSize: 6 + countRatio * 6 || 12,
      stroke: global.node.labelCfg.style.stroke,
      lineWidth: 3,
    },
  };

  if (!node.degree) {
    descreteNodes.push(node);
  }
});

const countRange = maxCount - minCount;
const minEdgeSize = 1;
const maxEdgeSize = 7;
const edgeSizeRange = maxEdgeSize - minEdgeSize;
edges.forEach((edge) => {
  // set edges' style
  const targetNode = currentNodeMap[edge.target];

  const size = ((edge.count - minCount) / countRange) * edgeSizeRange + minEdgeSize || 1;
  edge.size = size;

  const arrowWidth = Math.max(size / 2 + 2, 3);
  const arrowLength = 10;
  const arrowBeging = targetNode.size + arrowLength;
  let arrowPath = `M ${arrowBeging},0 L ${arrowBeging + arrowLength},-${arrowWidth} L ${
    arrowBeging + arrowLength
  },${arrowWidth} Z`;
  let d = targetNode.size / 2 + arrowLength;
  if (edge.source === edge.target) {
    edge.type = 'loop';
    arrowPath = undefined;
  }
  const sourceNode = currentNodeMap[edge.source];
  const isRealEdge = targetNode.isReal && sourceNode.isReal;
  edge.isReal = isRealEdge;
  const stroke = isRealEdge ? global.edge.style.realEdgeStroke : global.edge.style.stroke;
  edge.style = {
    stroke,
    cursor: 'pointer',
    lineAppendWidth: Math.max(edge.size || 5, 5),
    fillOpacity: 1,
     endArrow: arrowPath
       ? {
           path: arrowPath,
           d,
           fill: stroke,
           strokeOpacity: 0,
         }
       : false,
  };
  
  if (!edge.oriLabel) edge.oriLabel = edge.label;
  if (largeGraphMode || !edgeLabelVisible) edge.label = '';
  else {
    edge.label = labelFormatter(edge.label, labelMaxLength);
  }

  // arrange the other nodes around the hub
  const sourceDis = sourceNode.size / 2 + 20;
  const targetDis = targetNode.size / 2 + 20;
  if (sourceNode.x && !targetNode.x) {
    targetNode.x = sourceNode.x + sourceDis * Math.cos(Math.random() * Math.PI * 2);
  }
  if (sourceNode.y && !targetNode.y) {
    targetNode.y = sourceNode.y + sourceDis * Math.sin(Math.random() * Math.PI * 2);
  }
  if (targetNode.x && !sourceNode.x) {
    sourceNode.x = targetNode.x + targetDis * Math.cos(Math.random() * Math.PI * 2);
  }
  if (targetNode.y && !sourceNode.y) {
    sourceNode.y = targetNode.y + targetDis * Math.sin(Math.random() * Math.PI * 2);
  }

  if (!sourceNode.x && !sourceNode.y && manipulatePosition) {
    sourceNode.x = manipulatePosition.x + 30 * Math.cos(Math.random() * Math.PI * 2);
    sourceNode.y = manipulatePosition.y + 30 * Math.sin(Math.random() * Math.PI * 2);
  }
  if (!targetNode.x && !targetNode.y && manipulatePosition) {
    targetNode.x = manipulatePosition.x + 30 * Math.cos(Math.random() * Math.PI * 2);
    targetNode.y = manipulatePosition.y + 30 * Math.sin(Math.random() * Math.PI * 2);
  }
});

descreteNodeCenter = {
  x: width - paddingLeft,
  y: height - paddingTop,
};

descreteNodes.forEach((node) => {
  if (!node.x && !node.y) {
    node.x = descreteNodeCenter.x + 30 * Math.cos(Math.random() * Math.PI * 2);
    node.y = descreteNodeCenter.y + 30 * Math.sin(Math.random() * Math.PI * 2);
  }
});

G6.Util.processParallelEdges(edges, 12.5, 'custom-line');
  return {
    maxDegree,
    edges,
  };
};

const getForceLayoutConfig = (graph, largeGraphMode, configSettings) => {
  let {
    linkDistance,
    edgeStrength,
    nodeStrength,
    nodeSpacing,
    nodeSize,
    collideStrength,
    alpha,
    alphaDecay,
    alphaMin,
  } = configSettings || { preventOverlap: true };

  if (!linkDistance && linkDistance !== 0) linkDistance = 300;
  if (!edgeStrength && edgeStrength !== 0) edgeStrength = 50;
  if (!nodeStrength && nodeStrength !== 0) nodeStrength = 200;
  if (!nodeSpacing && nodeSpacing !== 0) nodeSpacing = 2;

  const config = {
    gravity: 20,
    speed: 20,
    time: 2,
    //Junior patch begin
    workerEnabled: true, 
    damping: 3,
    preventOverlap:false,
    minMovement:0,
    maxIteration:40,
    //Junior patch end
    linkDistance: (d) => {
      let dist = linkDistance;
      const sourceNode = nodeMap[d.source] || aggregatedNodeMap[d.source];
      const targetNode = nodeMap[d.target] || aggregatedNodeMap[d.target];
      // // Convergence points at both ends
      // if (sourceNode.level && targetNode.level) dist = linkDistance * 3;
      // // One end is the aggregation point, one end is the real node
      // else if (sourceNode.level || targetNode.level) dist = linkDistance * 1.5;
      if (!sourceNode.level && !targetNode.level) dist = linkDistance * 0.3;
      return dist;
    },
    edgeStrength: (d) => {
      const sourceNode = nodeMap[d.source] || aggregatedNodeMap[d.source];
      const targetNode = nodeMap[d.target] || aggregatedNodeMap[d.target];
      // The gravitational force between the aggregation nodes is small
      if (sourceNode.level && targetNode.level) return edgeStrength / 2;
      // Great gravitational force between the aggregation node and the real node
      if (sourceNode.level || targetNode.level) return edgeStrength;
      return edgeStrength;
    },
    nodeStrength: (d) => {
      // Give discrete points gravity and let them gather
      if (d.degree === 0) return -10;
      // The repulsive force of the aggregation point is large
      if (d.level) return nodeStrength * 2;
      return nodeStrength;
    },
    nodeSize: (d) => {
      if (!nodeSize && d.size) return d.size;
      return 50;
    },
    nodeSpacing: (d) => {
      if (d.degree === 0) return nodeSpacing * 2;
      if (d.level) return nodeSpacing;
      return nodeSpacing;
    },
    onLayoutEnd: () => {
      if (largeGraphMode) {
        graph.getEdges().forEach((edge) => {
          if (!edge.oriLabel) return;
          edge.update({
            label: labelFormatter(edge.oriLabel, labelMaxLength),
          });
        });
      }
    },
    tick: () => {
      graph.refreshPositions();
    },
    
  };

  if (nodeSize) config['nodeSize'] = nodeSize;
  if (collideStrength) config['collideStrength'] = collideStrength;
  if (alpha) config['alpha'] = alpha;
  if (alphaDecay) config['alphaDecay'] = alphaDecay;
  if (alphaMin) config['alphaMin'] = alphaMin;

  return config;
};

const hideItems = (graph) => {
  hiddenItemIds.forEach((id) => {
    graph.hideItem(id);
  });
};

const showItems = (graph) => {
  graph.getNodes().forEach((node) => {
    if (!node.isVisible()) graph.showItem(node);
  });
  graph.getEdges().forEach((edge) => {
    if (!edge.isVisible()) edge.showItem(edge);
  });
  hiddenItemIds = [];
};

const handleRefreshGraph = (
  graph,
  graphData,
  width,
  height,
  largeGraphMode,
  edgeLabelVisible,
  isNewGraph,
) => {
  if (!graphData || !graph) return;
  clearFocusItemState(graph);
  // reset the filtering
  graph.getNodes().forEach((node) => {
    if (!node.isVisible()) node.show();
  });
  graph.getEdges().forEach((edge) => {
    if (!edge.isVisible()) edge.show();
  });

  let nodes = [],
    edges = [];

  nodes = graphData.nodes;
  const processRes = processNodesEdges(
    nodes,
    graphData.edges || [],
    width,
    height,
    largeGraphMode,
    edgeLabelVisible,
    isNewGraph,
  );

  edges = processRes.edges;

  graph.changeData({ nodes, edges });

  hideItems(graph);
  graph.getNodes().forEach((node) => {
    node.toFront();
  });

  // layout.instance.stop();
  // 'force' requires the use of objects with different ids to make a new layout, otherwise the original reference will be used. 
  //So copy a copy of nodes and edges as the layout data of 'force'
  layout.instance.init({
    nodes: graphData.nodes,
    edges,
  });

  layout.instance.minMovement = 0.0001;
  // layout.instance.getCenter = d => {
  // 	const cachePosition = cachePositions[d.id];
  // 	if (!cachePosition && (d.x || d.y)) return [d.x, d.y, 10];
  // 	else if (cachePosition) return [cachePosition.x, cachePosition.y, 10];
  // 	return [width / 2, height / 2, 10];
  // }
  layout.instance.getMass = (d) => {
    const cachePosition = cachePositions[d.id];
    if (cachePosition) return 5;
    return 1;
  };
  layout.instance.execute();
  return { nodes, edges };
};

const getMixedGraph = (
  aggregatedData,
  originData,
  nodeMap,
  aggregatedNodeMap,
  expandArray,
  collapseArray,
) => {
  let nodes = [],
    edges = [];

  const expandMap = {},
    collapseMap = {};
  expandArray.forEach((expandModel) => {
    expandMap[expandModel.id] = true;
  });
  collapseArray.forEach((collapseModel) => {
    collapseMap[collapseModel.id] = true;
  });

  aggregatedData.clusters.forEach((cluster, i) => {
    if (expandMap[cluster.id]) {
      nodes = nodes.concat(cluster.nodes);
      aggregatedNodeMap[cluster.id].expanded = true;
    } else {
      nodes.push(aggregatedNodeMap[cluster.id]);
      aggregatedNodeMap[cluster.id].expanded = false;
    }
  });
  originData.edges.forEach((edge) => {
    const isSourceInExpandArray = expandMap[nodeMap[edge.source].clusterId];
    const isTargetInExpandArray = expandMap[nodeMap[edge.target].clusterId];
    if (isSourceInExpandArray && isTargetInExpandArray) {
      edges.push(edge);
    } else if (isSourceInExpandArray) {
      const targetClusterId = nodeMap[edge.target].clusterId;
      const vedge = {
        source: edge.source,
        target: targetClusterId,
        id: `edge-${uniqueId()}`,
        label: '',
      };
      edges.push(vedge);
    } else if (isTargetInExpandArray) {
      const sourceClusterId = nodeMap[edge.source].clusterId;
      const vedge = {
        target: edge.target,
        source: sourceClusterId,
        id: `edge-${uniqueId()}`,
        label: '',
      };
      edges.push(vedge);
    }
  });
  aggregatedData.clusterEdges.forEach((edge) => {
    if (expandMap[edge.source] || expandMap[edge.target]) return;
    else edges.push(edge);
  });
  return { nodes, edges };
};

const manageExpandCollapseArray = (nodeNumber, model, collapseArray, expandArray) => {
  manipulatePosition = { x: model.x, y: model.y };

  const currentNode = {
    id: model.id,
    level: model.level,
    parentId: model.parentId,
  };

  // Join the node that currently needs to be expanded
  expandArray.push(currentNode);

  graph.get('canvas').setCursor('default');
  return { expandArray, collapseArray };
};

const cacheNodePositions = (nodes) => {
  const positionMap = {};
  const nodeLength = nodes.length;
  for (let i = 0; i < nodeLength; i++) {
    const node = nodes[i].getModel();
    positionMap[node.id] = {
      x: node.x,
      y: node.y,
      level: node.level,
    };
  }
  return positionMap;
};

const stopLayout = () => {
  layout.instance.stop();
};

const bindListener = (graph) => {
  graph.on('keydown', (evt) => {
    const code = evt.key;
    if (!code) {
      return;
    }
    if (code.toLowerCase() === 'shift') {
      shiftKeydown = true;
    } else {
      shiftKeydown = false;
    }
  });
  graph.on('keyup', (evt) => {
    const code = evt.key;
    if (!code) {
      return;
    }
    if (code.toLowerCase() === 'shift') {
      shiftKeydown = false;
    }
  });
  graph.on('node:mouseenter', (evt) => {
    const { item } = evt;
    const model = item.getModel();
    const currentLabel = model.label;
    model.oriFontSize = model.labelCfg.style.fontSize;
    item.update({
      label: model.oriLabel,
    });
    model.oriLabel = currentLabel;
    graph.setItemState(item, 'hover', true);
    item.toFront();
  });

  graph.on('node:mouseleave', (evt) => {
    const { item } = evt;
    const model = item.getModel();
    const currentLabel = model.label;
    item.update({
      label: model.oriLabel,
    });
    model.oriLabel = currentLabel;
    graph.setItemState(item, 'hover', false);
  });

  graph.on('edge:mouseenter', (evt) => {
    const { item } = evt;
    const model = item.getModel();
    const currentLabel = model.label;
    item.update({
      label: model.oriLabel,
    });
    model.oriLabel = currentLabel;
    item.toFront();
    item.getSource().toFront();
    item.getTarget().toFront();
  });

  graph.on('edge:mouseleave', (evt) => {
    const { item } = evt;
    const model = item.getModel();
    const currentLabel = model.label;
    item.update({
      label: model.oriLabel,
    });
    model.oriLabel = currentLabel;
  });
  // click node to show the detail drawer
  graph.on('node:click', (evt) => {
    stopLayout();
    if (!shiftKeydown) clearFocusItemState(graph);
    else clearFocusEdgeState(graph);
    const { item } = evt;

    // highlight the clicked node, it is down by click-select
    graph.setItemState(item, 'focus', true);

    if (!shiftKeydown) {
      // Also highlight the relevant edges
      const relatedEdges = item.getEdges();
      relatedEdges.forEach((edge) => {
        graph.setItemState(edge, 'focus', true);
      });
    }
  });

  // click edge to show the detail of integrated edge drawer
  graph.on('edge:click', (evt) => {
    stopLayout();
    if (!shiftKeydown) clearFocusItemState(graph);
    const { item } = evt;
    // highlight the clicked edge
    graph.setItemState(item, 'focus', true);
  });

  // click canvas to cancel all the focus state
  graph.on('canvas:click', (evt) => {
    clearFocusItemState(graph);
    console.log(graph.getGroup(), graph.getGroup().getBBox(), graph.getGroup().getCanvasBBox());
  });
};


function LargeGraph (props){

  const ref = React.useRef(null);

  React.useEffect(() => {
    //refresh()
    const data = props.data
     
      CANVAS_WIDTH = 1000;
      CANVAS_HEIGHT = 800;
  
      nodeMap = {};
      //Algorithm
      
      if (props.mode === 1)
        var clusteredData = louvain(data, false, 'weight');
      else if (props.mode === 2)
        clusteredData = labelPropagation(data, false);
      //const clusteredData = GADDI(data, pattern, true, 0, 0, 'value', 'value')
       
      //Algorithm
      const aggregatedData = { nodes: [], edges: [] };
      clusteredData.clusters.forEach((cluster, i) => {
        cluster.nodes.forEach((node) => {
          node.level = 0;
          node.label = node.id;
          node.type = '';
          node.colorSet = colorSets[i];
          nodeMap[node.id] = node;
        });
        const cnode = {
          id: cluster.id,
          type: 'aggregated-node',
          count: cluster.nodes.length,
          level: 1,
          label: cluster.id,
          colorSet: colorSets[i],
          idx: i,
        };
        aggregatedNodeMap[cluster.id] = cnode;
        aggregatedData.nodes.push(cnode);
      });
      clusteredData.clusterEdges.forEach((clusterEdge) => {
        const cedge = {
          ...clusterEdge,
          size: Math.log(clusterEdge.count),
          label: '',
          id: `edge-${uniqueId()}`,
        };
        if (cedge.source === cedge.target) {
          cedge.type = 'loop';
          cedge.loopCfg = {
            dist: 20,
          };
        } else cedge.type = 'line';
        aggregatedData.edges.push(cedge);
      });
  
      data.edges.forEach((edge) => {
        edge.label = `${edge.source}-${edge.target}`;
        edge.id = `edge-${uniqueId()}`;
      });
  
      currentUnproccessedData = aggregatedData;
  
      const { edges: processedEdges } = processNodesEdges(
        currentUnproccessedData.nodes,
        currentUnproccessedData.edges,
        CANVAS_WIDTH,
        CANVAS_HEIGHT,
        largeGraphMode,
        true,
        true,
      );
  
      const contextMenu = new G6.Menu({
        shouldBegin(evt) {
          if (evt.target && evt.target.isCanvas && evt.target.isCanvas()) return true;
          if (evt.item) return true;
          return false;
        },
        getContent(evt) {
          const { item } = evt;
          if (evt.target && evt.target.isCanvas && evt.target.isCanvas()) {
            return `<ul>
            <li id='show'>Show all Hidden Items</li>
            <li id='collapseAll'>Collapse all Clusters</li>
          </ul>`;
          } else if (!item) return;
          const itemType = item.getType();
          const model = item.getModel();
          if (itemType && model) {
            if (itemType === 'node') {
              if (model.level !== 0) {
                return `<ul>
                <li id='expand'>Expand the Cluster</li>
                <li id='hide'>Hide the Node</li>
              </ul>`;
              } else {
                return `<ul>
                <li id='collapse'>Collapse the Cluster</li>
                <li id='hide'>Hide the Node</li>
              </ul>`;
              }
            } else {
              return `<ul>
              <li id='hide'>Hide the Edge</li>
            </ul>`;
            }
          }
        },
        handleMenuClick: (target, item) => {
          const model = item && item.getModel();
          const liIdStrs = target.id.split('-');
          let mixedGraphData;
          switch (liIdStrs[0]) {
            case 'hide':
              graph.hideItem(item);
              hiddenItemIds.push(model.id);
              break;
            case 'expand':
              const newArray = manageExpandCollapseArray(
                graph.getNodes().length,
                model,
                collapseArray,
                expandArray,
              );
              expandArray = newArray.expandArray;
              collapseArray = newArray.collapseArray;
              mixedGraphData = getMixedGraph(
                clusteredData,
                data,
                nodeMap,
                aggregatedNodeMap,
                expandArray,
                collapseArray,
              );
              break;
            case 'collapse':
              const aggregatedNode = aggregatedNodeMap[model.clusterId];
              manipulatePosition = { x: aggregatedNode.x, y: aggregatedNode.y };
              collapseArray.push(aggregatedNode);
              for (let i = 0; i < expandArray.length; i++) {
                if (expandArray[i].id === model.clusterId) {
                  expandArray.splice(i, 1);
                  break;
                }
              }
              mixedGraphData = getMixedGraph(
                clusteredData,
                data,
                nodeMap,
                aggregatedNodeMap,
                expandArray,
                collapseArray,
              );
              break;
            case 'collapseAll':
              expandArray = [];
              collapseArray = [];
              mixedGraphData = getMixedGraph(
                clusteredData,
                data,
                nodeMap,
                aggregatedNodeMap,
                expandArray,
                collapseArray,
              );
              break;
            case 'show':
              showItems(graph);
              break;
            default:
              break;
          }
          if (mixedGraphData) {
            cachePositions = cacheNodePositions(graph.getNodes());
            currentUnproccessedData = mixedGraphData;
            handleRefreshGraph(
              graph,
              currentUnproccessedData,
              CANVAS_WIDTH,
              CANVAS_HEIGHT,
              largeGraphMode,
              true,
              false,
            );
          }
        },
        offsetX: 16 + 10,
        offsetY: 0,

        itemTypes: ['node', 'edge', 'canvas'],
      });
  
      graph = new G6.Graph({
        container: ref.current,
        width: CANVAS_WIDTH,
        height: CANVAS_HEIGHT,
        linkCenter: true,
        minZoom: 0.1,
        groupByTypes: false,
        modes: {
          default: [
            {
              type: 'drag-canvas',
              enableOptimize: true,
            },
            {
              type: 'zoom-canvas',
              enableOptimize: true,
              optimizeZoom: 0.01,
            },
            'drag-node',
            'shortcuts-call',
            {
              type: 'tooltip',
              formatText(model) {
                var text = ""
                if(model['donutAttrs'] !== undefined ) {
                 text = `<p align="left">
                  id : ${model.id} <br/>
                  color : ${model.color} <br/>
                  size : ${model.size} <br/>
                  x : ${model.x} <br/>
                  y : ${model.y} <br/>
                  degree : ${model.degree} <br/>
                  
                  dountAttrs : <br/>
                      { <br/>
                        &nbsp;&nbsp;income: ${model['donutAttrs'].income} <br/>
                        &nbsp;&nbsp;outcome: ${model['donutAttrs'].outcome} <br/>
                        &nbsp;&nbsp;unknown: ${model['donutAttrs'].unknown}<br/>
                      }
                  </p>
                  `;
                }
                else {
                    text = `<p align="left">
                     id : ${model.id} <br/>
                     color : ${model.color} <br/>
                     size : ${model.size} <br/>
                     x : ${model.x} <br/>
                     y : ${model.y} <br/>
                     degree : ${model.degree} <br/>`;
                }
                
                return text;
              },
              shouldUpdate: (e) => true,
          },
          ],
          lassoSelect: [
            {
              type: 'zoom-canvas',
              enableOptimize: true,
              optimizeZoom: 0.01,
            },
            {
              type: 'lasso-select',
              selectedState: 'focus',
              trigger: 'drag',
            },
          ],
          fisheyeMode: [],
        },
        defaultNode: {
          type: 'aggregated-node',
          size: DEFAULTNODESIZE,
        },
        plugins: [contextMenu],
      });
  
      graph.get('canvas').set('localRefresh', false);
  
      const layoutConfig = getForceLayoutConfig(graph, largeGraphMode);
      layoutConfig.center = [CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2];
      layout.instance = new G6.Layout['gForce'](layoutConfig);
      layout.instance.init({
        nodes: currentUnproccessedData.nodes,
        edges: processedEdges,
      });
      layout.instance.execute();
  
      bindListener(graph);
      graph.data({ nodes: aggregatedData.nodes, edges: processedEdges });
      graph.render();
    



    return () => {
        graph.changeData(props.data);
    };
  });

  return <>
      <div ref={ref}></div>
  </>;
}

export default LargeGraph