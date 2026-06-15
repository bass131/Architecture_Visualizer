using System;

class WorkQueue { public void Push(Action action) { } public void Drain() { } }
class StepSystem { public void Advance() { } }

class TickCoordinator
{
    private readonly WorkQueue _queue = new WorkQueue();
    private readonly StepSystem _first = new StepSystem();
    private readonly StepSystem _second = new StepSystem();
    private int _tick;
    private bool _running;

    public void EnqueueJob(Action action) => _queue.Push(action);
    public void Start() => _running = true;
    public void Stop() => _running = false;
    public void Tick()
    {
        _tick = _tick + 1;
        _queue.Drain();
        _first.Advance();
        _second.Advance();
    }
}
