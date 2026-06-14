from typing import Generic, Type, TypeVar, Any, Optional
from sqlalchemy.orm import Session

ModelType = TypeVar("ModelType")

class BaseRepository(Generic[ModelType]):
    def __init__(self, model: Type[ModelType]):
        self.model = model

    def get(self, db: Session, id: Any) -> Optional[ModelType]:
        return db.query(self.model).filter(self.model.id == id).first()

    def get_all(self, db: Session) -> list[ModelType]:
        return db.query(self.model).all()

    def create(self, db: Session, obj: ModelType) -> ModelType:
        db.add(obj)
        db.commit()
        db.refresh(obj)
        return obj

    def delete(self, db: Session, id: Any) -> Optional[ModelType]:
        obj = self.get(db, id)
        if obj:
            db.delete(obj)
            db.commit()
        return obj
