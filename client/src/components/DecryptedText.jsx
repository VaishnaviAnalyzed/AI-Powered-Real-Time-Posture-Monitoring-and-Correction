import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { motion } from 'motion/react';

const styles = {
  wrapper: { display: 'inline-block', whiteSpace: 'pre-wrap' },
  srOnly: {
    position: 'absolute', width: '1px', height: '1px',
    padding: 0, margin: '-1px', overflow: 'hidden',
    clip: 'rect(0,0,0,0)', border: 0
  }
};

export default function DecryptedText({
  text, speed = 50, maxIterations = 10, sequential = false,
  revealDirection = 'start', useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className = '', parentClassName = '', encryptedClassName = '',
  animateOn = 'hover', clickMode = 'once', ...props
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(animateOn !== 'click');
  const [direction, setDirection] = useState('forward');
  const containerRef = useRef(null);
  const orderRef = useRef([]);
  const pointerRef = useRef(0);
  const intervalRef = useRef(null);

  const availableChars = useMemo(() =>
    useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter(c => c !== ' ')
      : characters.split(''),
    [useOriginalCharsOnly, text, characters]
  );

  const shuffleText = useCallback((originalText, currentRevealed) =>
    originalText.split('').map((char, i) => {
      if (char === ' ') return ' ';
      if (currentRevealed.has(i)) return originalText[i];
      return availableChars[Math.floor(Math.random() * availableChars.length)];
    }).join(''),
    [availableChars]
  );

  const computeOrder = useCallback(len => {
    const order = [];
    if (len <= 0) return order;
    if (revealDirection === 'start') { for (let i = 0; i < len; i++) order.push(i); return order; }
    if (revealDirection === 'end')   { for (let i = len-1; i >= 0; i--) order.push(i); return order; }
    const middle = Math.floor(len / 2); let offset = 0;
    while (order.length < len) {
      const idx = offset % 2 === 0 ? middle + offset/2 : middle - Math.ceil(offset/2);
      if (idx >= 0 && idx < len) order.push(idx);
      offset++;
    }
    return order.slice(0, len);
  }, [revealDirection]);

  const fillAllIndices = useCallback(() => {
    const s = new Set(); for (let i = 0; i < text.length; i++) s.add(i); return s;
  }, [text]);

  const removeRandomIndices = useCallback((set, count) => {
    const arr = Array.from(set);
    for (let i = 0; i < count && arr.length > 0; i++) arr.splice(Math.floor(Math.random()*arr.length), 1);
    return new Set(arr);
  }, []);

  const encryptInstantly = useCallback(() => {
    const emptySet = new Set();
    setRevealedIndices(emptySet); setDisplayText(shuffleText(text, emptySet)); setIsDecrypted(false);
  }, [text, shuffleText]);

  const triggerDecrypt = useCallback(() => {
    if (sequential) { orderRef.current = computeOrder(text.length); pointerRef.current = 0; setRevealedIndices(new Set()); }
    else setRevealedIndices(new Set());
    setDirection('forward'); setIsAnimating(true);
  }, [sequential, computeOrder, text.length]);

  const triggerReverse = useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length).slice().reverse();
      pointerRef.current = 0;
      setRevealedIndices(fillAllIndices());
      setDisplayText(shuffleText(text, fillAllIndices()));
    } else {
      setRevealedIndices(fillAllIndices());
      setDisplayText(shuffleText(text, fillAllIndices()));
    }
    setDirection('reverse'); setIsAnimating(true);
  }, [sequential, computeOrder, fillAllIndices, shuffleText, text]);

  useEffect(() => {
    if (!isAnimating) return;
    let currentIteration = 0;
    const getNextIndex = revealedSet => {
      const len = text.length;
      if (revealDirection === 'start') return revealedSet.size;
      if (revealDirection === 'end')   return len - 1 - revealedSet.size;
      const middle = Math.floor(len/2), offset = Math.floor(revealedSet.size/2);
      const next = revealedSet.size % 2 === 0 ? middle+offset : middle-offset-1;
      if (next >= 0 && next < len && !revealedSet.has(next)) return next;
      for (let i = 0; i < len; i++) if (!revealedSet.has(i)) return i;
      return 0;
    };
    intervalRef.current = setInterval(() => {
      setRevealedIndices(prev => {
        if (sequential) {
          if (direction === 'forward') {
            if (prev.size < text.length) {
              const n = new Set(prev); n.add(getNextIndex(prev));
              setDisplayText(shuffleText(text, n)); return n;
            } else { clearInterval(intervalRef.current); setIsAnimating(false); setIsDecrypted(true); return prev; }
          }
          if (direction === 'reverse') {
            if (pointerRef.current < orderRef.current.length) {
              const n = new Set(prev); n.delete(orderRef.current[pointerRef.current++]);
              setDisplayText(shuffleText(text, n));
              if (n.size === 0) { clearInterval(intervalRef.current); setIsAnimating(false); setIsDecrypted(false); }
              return n;
            } else { clearInterval(intervalRef.current); setIsAnimating(false); setIsDecrypted(false); return prev; }
          }
        } else {
          if (direction === 'forward') {
            setDisplayText(shuffleText(text, prev)); currentIteration++;
            if (currentIteration >= maxIterations) { clearInterval(intervalRef.current); setIsAnimating(false); setDisplayText(text); setIsDecrypted(true); }
            return prev;
          }
          if (direction === 'reverse') {
            let cur = prev.size === 0 ? fillAllIndices() : prev;
            const next = removeRandomIndices(cur, Math.max(1, Math.ceil(text.length/Math.max(1,maxIterations))));
            setDisplayText(shuffleText(text, next)); currentIteration++;
            if (next.size === 0 || currentIteration >= maxIterations) {
              clearInterval(intervalRef.current); setIsAnimating(false); setIsDecrypted(false);
              setDisplayText(shuffleText(text, new Set())); return new Set();
            }
            return next;
          }
        }
        return prev;
      });
    }, speed);
    return () => clearInterval(intervalRef.current);
  }, [isAnimating, text, speed, maxIterations, sequential, revealDirection, shuffleText, direction, fillAllIndices, removeRandomIndices]);

  const handleClick = () => {
    if (animateOn !== 'click') return;
    if (clickMode === 'once') { if (!isDecrypted) triggerDecrypt(); }
    if (clickMode === 'toggle') { isDecrypted ? triggerReverse() : triggerDecrypt(); }
  };

  const triggerHoverDecrypt = useCallback(() => {
    if (isAnimating) return;
    setRevealedIndices(new Set()); setIsDecrypted(false); setDisplayText(text);
    setDirection('forward'); setIsAnimating(true);
  }, [isAnimating, text]);

  const resetToPlainText = useCallback(() => {
    clearInterval(intervalRef.current); setIsAnimating(false);
    setRevealedIndices(new Set()); setDisplayText(text); setIsDecrypted(true); setDirection('forward');
  }, [text]);

  useEffect(() => {
    if (animateOn !== 'view' && animateOn !== 'inViewHover') return;
    const obs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting && !hasAnimated) { triggerDecrypt(); setHasAnimated(true); } });
    }, { threshold: 0.1 });
    const ref = containerRef.current;
    if (ref) obs.observe(ref);
    return () => { if (ref) obs.unobserve(ref); };
  }, [animateOn, hasAnimated, triggerDecrypt]);

  useEffect(() => {
    if (animateOn === 'click') encryptInstantly();
    else { setDisplayText(text); setIsDecrypted(true); }
    setRevealedIndices(new Set()); setDirection('forward');
  }, [animateOn, text, encryptInstantly]);

  const animateProps =
    animateOn === 'hover' || animateOn === 'inViewHover'
      ? { onMouseEnter: triggerHoverDecrypt, onMouseLeave: resetToPlainText }
      : animateOn === 'click' ? { onClick: handleClick } : {};

  return (
    <motion.span className={parentClassName} ref={containerRef} style={styles.wrapper} {...animateProps} {...props}>
      <span style={styles.srOnly}>{displayText}</span>
      <span aria-hidden="true">
        {displayText.split('').map((char, i) => {
          const revealed = revealedIndices.has(i) || (!isAnimating && isDecrypted);
          return <span key={i} className={revealed ? className : encryptedClassName}>{char}</span>;
        })}
      </span>
    </motion.span>
  );
}
