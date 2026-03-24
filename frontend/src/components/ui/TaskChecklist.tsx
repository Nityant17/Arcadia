import { useEffect, useState } from 'react';
import styled from 'styled-components';

type ChecklistTask = {
  id: string;
  label: string;
  completed: boolean;
};

type TaskChecklistProps = {
  isEditing: boolean;
};

const STORAGE_KEY = 'arcadia.daily-goals.tasks.v1';

const defaultTasks: ChecklistTask[] = [
  { id: 'task1', label: 'Review AI Engineering notes', completed: true },
  { id: 'task2', label: 'Complete Tier 2 Challenge', completed: false },
  { id: 'task3', label: 'Plan study session', completed: false }
];

const isValidTaskList = (value: unknown): value is ChecklistTask[] => {
  if (!Array.isArray(value)) return false;
  return value.every((task) => {
    if (!task || typeof task !== 'object') return false;
    const candidate = task as ChecklistTask;
    return typeof candidate.id === 'string' && typeof candidate.label === 'string' && typeof candidate.completed === 'boolean';
  });
};

export const TaskChecklist = ({ isEditing }: TaskChecklistProps) => {
  const [tasks, setTasks] = useState<ChecklistTask[]>(() => {
    try {
      const rawTasks = window.localStorage.getItem(STORAGE_KEY);
      if (!rawTasks) return defaultTasks;
      const parsedTasks: unknown = JSON.parse(rawTasks);
      return isValidTaskList(parsedTasks) ? parsedTasks : defaultTasks;
    } catch {
      return defaultTasks;
    }
  });
  const [newTask, setNewTask] = useState('');

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  }, [tasks]);

  const handleToggleTask = (id: string) => {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task
      )
    );
  };

  const handleRemoveTask = (id: string) => {
    setTasks((previousTasks) => previousTasks.filter((task) => task.id !== id));
  };

  const handleUpdateTaskLabel = (id: string, value: string) => {
    setTasks((previousTasks) =>
      previousTasks.map((task) =>
        task.id === id ? { ...task, label: value } : task
      )
    );
  };

  useEffect(() => {
    if (!isEditing) {
      setTasks((previousTasks) =>
        previousTasks
          .map((task) => ({ ...task, label: task.label.trim() }))
          .filter((task) => task.label.length > 0)
      );
      setNewTask('');
    }
  }, [isEditing]);

  const handleAddTask = () => {
    const nextValue = newTask.trim();
    if (!nextValue) return;

    const nextTask: ChecklistTask = {
      id: `task-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      label: nextValue,
      completed: false
    };

    setTasks((previousTasks) => [...previousTasks, nextTask]);
    setNewTask('');
  };

  return (
    <StyledWrapper>
      <div id="checklist">
        <div className="taskList" role="list">
          {tasks.map((task) => (
            <div className="taskRow" role="listitem" key={task.id}>
              {isEditing ? (
                <>
                  <span className="editBullet" aria-hidden="true">•</span>
                  <input
                    className="taskEditor"
                    value={task.label}
                    onChange={(event) => handleUpdateTaskLabel(task.id, event.target.value)}
                    aria-label={`Edit ${task.label || 'task'}`}
                  />
                  <button
                    type="button"
                    className="deleteIconButton"
                    onClick={() => handleRemoveTask(task.id)}
                    aria-label={`Delete ${task.label || 'task'}`}
                  >
                    ×
                  </button>
                </>
              ) : (
                <>
                  <input
                    id={task.id}
                    type="checkbox"
                    className="taskCheckbox"
                    checked={task.completed}
                    onChange={() => handleToggleTask(task.id)}
                    aria-label={`Mark ${task.label} complete`}
                  />
                  <label htmlFor={task.id}>{task.label}</label>
                </>
              )}
            </div>
          ))}
        </div>

        {isEditing && (
          <div className="addRow">
            <input
              value={newTask}
              onChange={(event) => setNewTask(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleAddTask();
              }}
              className="addInput"
              placeholder="Add a daily goal"
              aria-label="Add a daily goal"
            />
            <button type="button" className="addButton" onClick={handleAddTask}>
              Add
            </button>
          </div>
        )}
      </div>
    </StyledWrapper>
  );
};

const StyledWrapper = styled.div`
  width: 100%;

  #checklist {
    --text: #e2e8f0;
    --check: #06b6d4;
    --disabled: #64748b;
    --surface: rgba(15, 23, 42, 0.45);
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.875rem;
  }

  .taskList {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .taskRow {
    width: 100%;
    display: grid;
    grid-template-columns: 18px 1fr;
    align-items: center;
    gap: 0.65rem;
  }

  .taskRow:has(.taskEditor) {
    grid-template-columns: 12px 1fr auto;
    gap: 0.5rem;
  }

  .editBullet {
    color: var(--check);
    font-size: 0.9rem;
    line-height: 1;
    opacity: 0.9;
    margin-top: -1px;
  }

  .taskCheckbox {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    position: relative;
    width: 15px;
    height: 15px;
    border: 0;
    border-radius: 0;
    background: transparent;
    cursor: pointer;
    display: grid;
    place-content: center;
    transition: none;
    margin: 0;
  }

  .taskCheckbox::before,
  .taskCheckbox::after {
    content: '';
    position: absolute;
    height: 2px;
    top: auto;
    background: var(--check);
    border-radius: 2px;
  }

  .taskCheckbox::before {
    width: 0;
    right: 56%;
    transform-origin: right bottom;
  }

  .taskCheckbox::after {
    width: 0;
    left: 38%;
    transform-origin: left bottom;
  }

  .taskCheckbox:checked::before {
    animation: check-01 0.4s ease forwards;
  }

  .taskCheckbox:checked::after {
    animation: check-02 0.4s ease forwards;
  }

  .taskCheckbox:checked {
    background: transparent;
  }

  #checklist label {
    color: var(--text);
    position: relative;
    cursor: pointer;
    display: inline-block;
    width: 100%;
    max-width: 100%;
    transition: color 0.3s ease;
    font-size: 0.9rem;
    line-height: 1.3;
    word-break: break-word;
    overflow-wrap: anywhere;
    overflow: visible;
  }

  #checklist label::before,
  #checklist label::after {
    content: '';
    position: absolute;
  }

  #checklist label::before {
    height: 2px;
    width: 8px;
    left: -27px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--check);
    border-radius: 2px;
    transition: background 0.3s ease;
  }

  #checklist label::after {
    height: 4px;
    width: 4px;
    top: 50%;
    left: -25px;
    transform: translateY(-50%);
    border-radius: 50%;
  }

  #checklist input[type='checkbox']:checked + label {
    color: var(--disabled);
    animation: move 0.3s ease 0.1s forwards;
  }

  #checklist input[type='checkbox']:checked + label::before {
    background: var(--disabled);
    animation: slice 0.4s ease forwards;
  }

  #checklist input[type='checkbox']:checked + label::after {
    animation: firework 0.5s ease forwards 0.1s;
  }

  @keyframes move {
    50% {
      padding-left: 8px;
      padding-right: 0;
    }

    100% {
      padding-right: 4px;
    }
  }

  @keyframes slice {
    60% {
      width: 100%;
      left: 2px;
      top: 50%;
      transform: translateY(-50%);
    }

    100% {
      width: 100%;
      left: 0;
      top: 50%;
      transform: translateY(-50%);
    }
  }

  @keyframes check-01 {
    0% {
      width: 4px;
      transform: rotate(0);
    }

    50% {
      width: 0;
      transform: rotate(0);
    }

    51% {
      width: 0;
      top: 8px;
      transform: rotate(45deg);
    }

    100% {
      width: 5px;
      top: 8px;
      transform: rotate(45deg);
    }
  }

  @keyframes check-02 {
    0% {
      width: 4px;
      transform: rotate(0);
    }

    50% {
      width: 0;
      transform: rotate(0);
    }

    51% {
      width: 0;
      top: 8px;
      transform: rotate(-45deg);
    }

    100% {
      width: 10px;
      top: 8px;
      transform: rotate(-45deg);
    }
  }

  .taskEditor,
  .addInput {
    border: 1px solid rgba(148, 163, 184, 0.35);
    background: var(--surface);
    color: var(--text);
    border-radius: 0.55rem;
    padding: 0.35rem 0.55rem;
    font-size: 0.88rem;
    min-width: 0;
    width: 100%;
  }

  .taskEditor:focus,
  .addInput:focus {
    outline: none;
    border-color: var(--check);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.2);
  }

  .deleteIconButton,
  .addButton {
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(15, 23, 42, 0.75);
    color: var(--text);
    border-radius: 0.5rem;
    font-size: 0.74rem;
    line-height: 1;
    padding: 0.34rem 0.5rem;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease;
  }

  .deleteIconButton:hover,
  .addButton:hover {
    border-color: var(--check);
    color: #67e8f9;
  }

  .addRow {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    width: 100%;
    margin-top: 0.15rem;
  }

  @keyframes firework {
    0% {
      opacity: 1;
      box-shadow: 0 0 0 -2px #06b6d4, 0 0 0 -2px #06b6d4, 0 0 0 -2px #06b6d4,
        0 0 0 -2px #06b6d4, 0 0 0 -2px #06b6d4, 0 0 0 -2px #06b6d4;
    }

    30% {
      opacity: 1;
    }

    100% {
      opacity: 0;
      box-shadow: 0 -12px 0 0 #06b6d4, 11px -6px 0 0 #06b6d4, 11px 6px 0 0 #06b6d4,
        0 12px 0 0 #06b6d4, -11px 6px 0 0 #06b6d4, -11px -6px 0 0 #06b6d4;
    }
  }
`;