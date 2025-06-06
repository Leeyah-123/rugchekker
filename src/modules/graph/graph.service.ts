import { createCanvas } from '@napi-rs/canvas';
import { Injectable, Logger } from '@nestjs/common';
import { InsidersGraphData } from 'src/common/interfaces/rugcheck';
import { truncateAddress } from 'src/shared/utils';

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  async generateInsidersGraph(
    data: InsidersGraphData[],
    participantsOnly = false,
  ): Promise<Buffer> {
    try {
      // Increase canvas size for better spread
      const canvas = createCanvas(2800, 2000);
      const ctx = canvas.getContext('2d');

      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      if (!data[0]) {
        throw new Error('No graph data provided');
      }

      let { nodes, links } = data.reduce(
        (acc, item) => {
          acc.nodes.push(...item.nodes);
          acc.links.push(...item.links);
          return acc;
        },
        { nodes: [], links: [] },
      );

      // Filter nodes if participantsOnly is true
      if (participantsOnly) {
        const participantNodes = nodes.filter((n) => n.participant);
        const participantIds = new Set(participantNodes.map((n) => n.id));
        nodes = participantNodes;
        links = links.filter(
          (link) =>
            participantIds.has(link.source) && participantIds.has(link.target),
        );
      }

      // Helper to truncate addresses
      const truncateId = (addr: string, length = 6) =>
        truncateAddress(addr, length, length);

      // Create position map using basic force-directed placement
      const positions = new Map<string, { x: number; y: number }>();

      // Calculate total holdings for relative size scaling
      const totalHoldings = nodes.reduce((sum, node) => sum + node.holdings, 0);
      const maxHoldings = Math.max(...nodes.map((node) => node.holdings));

      // Initialize positions in a more spread out pattern
      // Participants in inner circle, non-participants in outer circle
      const participants = nodes.filter((n) => n.participant);
      const nonParticipants = nodes.filter((n) => !n.participant);

      const innerRadius = Math.min(canvas.width, canvas.height) * 0.25;
      const outerRadius = Math.min(canvas.width, canvas.height) * 0.4;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;

      // Position participants in inner circle
      participants.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / participants.length;
        positions.set(node.id, {
          x: centerX + innerRadius * Math.cos(angle),
          y: centerY + innerRadius * Math.sin(angle),
        });
      });

      // Position non-participants in outer circle
      nonParticipants.forEach((node, index) => {
        const angle = (2 * Math.PI * index) / nonParticipants.length;
        positions.set(node.id, {
          x: centerX + outerRadius * Math.cos(angle),
          y: centerY + outerRadius * Math.sin(angle),
        });
      });

      // Increase iterations for better layout
      const iterations = 100;
      // Adjust force calculation constants
      const repulsionStrength = 12000;
      const minDistance = 250;
      const attractionStrength = 0.015;
      const idealLinkLength = 350;

      // Force-directed layout simulation
      for (let i = 0; i < iterations; i++) {
        // Repulsion between all nodes (inverse square law)
        nodes.forEach((node1) => {
          nodes.forEach((node2) => {
            if (node1.id !== node2.id) {
              const pos1 = positions.get(node1.id)!;
              const pos2 = positions.get(node2.id)!;
              const dx = pos1.x - pos2.x;
              const dy = pos1.y - pos2.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              if (dist < minDistance * 2) {
                const force = repulsionStrength / (dist * dist);
                const moveX = (dx / dist) * force;
                const moveY = (dy / dist) * force;

                pos1.x += moveX;
                pos1.y += moveY;
                pos2.x -= moveX;
                pos2.y -= moveY;
              }
            }
          });

          // Keep nodes within bounds
          const pos = positions.get(node1.id)!;
          const padding = 100;
          pos.x = Math.max(padding, Math.min(canvas.width - padding, pos.x));
          pos.y = Math.max(padding, Math.min(canvas.height - padding, pos.y));
        });

        // Attraction along edges (Hooke's law)
        links.forEach((link) => {
          const pos1 = positions.get(link.source)!;
          const pos2 = positions.get(link.target)!;
          const dx = pos2.x - pos1.x;
          const dy = pos2.y - pos1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const force = (dist - idealLinkLength) * attractionStrength;

          const moveX = (dx / dist) * force;
          const moveY = (dy / dist) * force;

          pos1.x += moveX;
          pos2.x -= moveX;
          pos1.y += moveY;
          pos2.y -= moveY;
        });
      }

      // Draw edges with gradient based on holdings
      ctx.lineWidth = 2; // Increased line width
      links.forEach((link) => {
        const pos1 = positions.get(link.source)!;
        const pos2 = positions.get(link.target)!;
        const sourceNode = nodes.find((n) => n.id === link.source)!;
        const targetNode = nodes.find((n) => n.id === link.target)!;

        // Calculate edge length and angle for arrow
        const dx = pos2.x - pos1.x;
        const dy = pos2.y - pos1.y;
        const angle = Math.atan2(dy, dx);
        const length = Math.sqrt(dx * dx + dy * dy);

        // Draw edge with gradient
        const gradient = ctx.createLinearGradient(
          pos1.x,
          pos1.y,
          pos2.x,
          pos2.y,
        );
        const sourceAlpha = Math.min(
          0.9,
          sourceNode.holdings / maxHoldings + 0.3,
        );
        const targetAlpha = Math.min(
          0.9,
          targetNode.holdings / maxHoldings + 0.3,
        );

        gradient.addColorStop(0, `rgba(100, 100, 255, ${sourceAlpha})`);
        gradient.addColorStop(1, `rgba(100, 100, 255, ${targetAlpha})`);

        ctx.strokeStyle = gradient;
        ctx.beginPath();
        ctx.moveTo(pos1.x, pos1.y);

        // Draw slightly curved lines
        const midX = (pos1.x + pos2.x) / 2;
        const midY = (pos1.y + pos2.y) / 2;
        const curveFactor = 30; // Adjust curve intensity
        const perpX = (-dy * curveFactor) / length;
        const perpY = (dx * curveFactor) / length;

        ctx.quadraticCurveTo(midX + perpX, midY + perpY, pos2.x, pos2.y);
        ctx.stroke();

        // Draw arrow
        const arrowLength = 15;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const arrowWidth = 8; // DO NOT REMOVE THIS
        const arrowPos = 0.6; // Position arrow at 60% of the line

        const arrowX = pos1.x + dx * arrowPos;
        const arrowY = pos1.y + dy * arrowPos;

        ctx.fillStyle = `rgba(100, 100, 255, ${targetAlpha})`;
        ctx.beginPath();
        ctx.moveTo(
          arrowX - arrowLength * Math.cos(angle - Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle - Math.PI / 6),
        );
        ctx.lineTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowLength * Math.cos(angle + Math.PI / 6),
          arrowY - arrowLength * Math.sin(angle + Math.PI / 6),
        );
        ctx.closePath();
        ctx.fill();
      });

      // Draw node labels with size based on holdings
      nodes.forEach((node) => {
        const pos = positions.get(node.id)!;
        const label = truncateId(node.id);

        // Calculate font size based on holdings percentage
        const holdingsPercentage = (node.holdings / totalHoldings) * 100;
        const minFontSize = 12;
        const maxFontSize = 32;
        const fontSize = Math.max(
          minFontSize,
          Math.min(maxFontSize, minFontSize + holdingsPercentage * 0.8),
        );

        ctx.font = `bold ${fontSize}px OpenSans`;

        // Add background with opacity based on holdings
        const metrics = ctx.measureText(label);
        const padding = fontSize * 0.3;
        const bgAlpha = Math.min(0.9, node.holdings / maxHoldings + 0.3);

        ctx.fillStyle = `rgba(255, 255, 255, ${bgAlpha})`;
        ctx.fillRect(
          pos.x - metrics.width / 2 - padding,
          pos.y - fontSize / 2 - padding,
          metrics.width + padding * 2,
          fontSize + padding * 2,
        );

        // Draw text with participant status color
        ctx.fillStyle = node.participant ? '#ff0000' : '#444444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, pos.x, pos.y);

        // Add holdings indicator
        const holdingsText = `${holdingsPercentage.toFixed(1)}%`;
        ctx.font = `${minFontSize}px OpenSans`;
        ctx.fillStyle = node.participant ? '#ff0000' : '#666666';
        ctx.fillText(holdingsText, pos.x, pos.y + fontSize * 0.8);
      });

      // Add title with background
      const titleText = 'Insider Trade Network';
      ctx.font = 'bold 32px OpenSans';
      const titleMetrics = ctx.measureText(titleText);

      ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.fillRect(
        canvas.width / 2 - titleMetrics.width / 2 - 20,
        20,
        titleMetrics.width + 40,
        50,
      );

      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.fillText(titleText, canvas.width / 2, 50);

      // Add legend
      const legendY = 80;
      ctx.font = 'bold 16px OpenSans';
      ctx.fillStyle = '#ff0000';
      ctx.textAlign = 'left';
      ctx.fillText('● Participants', 50, legendY);
      ctx.fillStyle = '#444444';
      ctx.fillText('● Non-participants', 50, legendY + 25);
      ctx.fillStyle = '#666666';
      ctx.font = '14px OpenSans';
      ctx.fillText('(Size indicates holdings %)', 50, legendY + 50);

      return canvas.toBuffer('image/png');
    } catch (error) {
      this.logger.error('Error generating graph:', error);
      throw new Error('Failed to generate graph');
    }
  }

  async generateCandlestickGraph(
    data: any[],
    symbol: string,
    duration: string,
  ): Promise<Buffer> {
    try {
      const canvas = createCanvas(1200, 800);
      const ctx = canvas.getContext('2d');

      // Set white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Calculate scaling factors
      const padding = 60;
      const chartWidth = canvas.width - padding * 2;
      const chartHeight = canvas.height - padding * 2;

      const prices = data.flatMap((candle) => [candle.high, candle.low]);
      const maxPrice = Math.max(...prices);
      const minPrice = Math.min(...prices);
      const priceRange = maxPrice - minPrice;

      const volumes = data.map((candle) => candle.volume);
      const maxVolume = Math.max(...volumes);

      // Draw candlesticks
      const candleWidth = (chartWidth / data.length) * 0.8;
      data.forEach((candle, i) => {
        const x = padding + (chartWidth * i) / data.length;
        const open =
          chartHeight -
          ((candle.open - minPrice) / priceRange) * chartHeight +
          padding;
        const close =
          chartHeight -
          ((candle.close - minPrice) / priceRange) * chartHeight +
          padding;
        const high =
          chartHeight -
          ((candle.high - minPrice) / priceRange) * chartHeight +
          padding;
        const low =
          chartHeight -
          ((candle.low - minPrice) / priceRange) * chartHeight +
          padding;

        // Draw volume bars
        const volumeHeight = (candle.volume / maxVolume) * (chartHeight * 0.2);
        ctx.fillStyle =
          candle.close >= candle.open
            ? 'rgba(0, 255, 0, 0.5)'
            : 'rgba(255, 0, 0, 0.5)';
        ctx.fillRect(
          x,
          canvas.height - padding - volumeHeight,
          candleWidth,
          volumeHeight,
        );

        // Draw candlestick
        ctx.strokeStyle = 'black';
        ctx.beginPath();
        ctx.moveTo(x + candleWidth / 2, high);
        ctx.lineTo(x + candleWidth / 2, low);
        ctx.stroke();

        ctx.fillStyle = candle.close >= candle.open ? 'green' : 'red';
        ctx.fillRect(
          x,
          Math.min(open, close),
          candleWidth,
          Math.abs(close - open),
        );
      });

      // Draw axes
      ctx.strokeStyle = 'black';
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, canvas.height - padding);
      ctx.lineTo(canvas.width - padding, canvas.height - padding);
      ctx.stroke();

      // Add labels
      ctx.font = 'bold 16px OpenSans';
      ctx.fillStyle = 'black';
      ctx.textAlign = 'center';
      ctx.fillText(
        `${symbol} Price Chart (${duration})`,
        canvas.width / 2,
        padding / 2,
      );

      // Price labels
      ctx.textAlign = 'right';
      ctx.font = '12px OpenSans';
      for (let i = 0; i <= 5; i++) {
        const price = minPrice + (priceRange * i) / 5;
        const y = chartHeight - (chartHeight * i) / 5 + padding;
        ctx.fillText(`$${price.toFixed(4)}`, padding - 5, y + 4);
      }

      // Time labels
      ctx.textAlign = 'center';
      const timeStep = Math.max(1, Math.floor(data.length / 5));
      for (let i = 0; i < data.length; i += timeStep) {
        const x = padding + (chartWidth * i) / data.length;
        const date = new Date(data[i].timestamp);
        ctx.fillText(
          date.toLocaleTimeString(),
          x,
          canvas.height - padding + 20,
        );
      }

      return canvas.toBuffer('image/png');
    } catch (error) {
      this.logger.error('Error generating candlestick graph:', error);
      throw new Error('Failed to generate candlestick graph');
    }
  }
}
